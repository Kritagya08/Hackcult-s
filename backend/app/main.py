from __future__ import annotations

import uuid
from calendar import monthrange
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .config import settings
from .database import get_db
from .models import Challenge, Completion, EnergyEntry, Profile, WaterEntry
from .schemas import CompletionCreate, EnergyEntryCreate, ProfileCreate, SolarEstimateCreate, WaterEntryCreate
from .services import (
    calculate_achievements,
    calculate_streak,
    decimal_2,
    decimal_4,
    footprint_value,
    latest_change_percent,
    personalized_nudges,
    solar_estimate,
    water_daily_average,
)


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: list[Any] | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []


def error_response(status_code: int, code: str, message: str, details: list[Any] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details or []}},
    )


def utc_z(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def profile_json(profile: Profile) -> dict[str, Any]:
    return {
        "id": str(profile.id),
        "display_name": profile.display_name,
        "city": profile.city,
        "created_at": utc_z(profile.created_at),
    }


def energy_json(entry: EnergyEntry) -> dict[str, Any]:
    return {
        "id": str(entry.id),
        "profile_id": str(entry.profile_id),
        "period_month": entry.period_month.isoformat(),
        "electricity_kwh": decimal_2(entry.electricity_kwh),
        "created_at": utc_z(entry.created_at),
    }


def water_json(entry: WaterEntry) -> dict[str, Any]:
    return {
        "id": str(entry.id),
        "profile_id": str(entry.profile_id),
        "month": entry.month.isoformat(),
        "litres": decimal_2(entry.litres),
        "created_at": utc_z(entry.created_at),
    }


def challenge_json(challenge: Challenge) -> dict[str, Any]:
    return {
        "id": str(challenge.id),
        "code": challenge.code,
        "title": challenge.title,
        "description": challenge.description,
        "points": challenge.points,
        "active": challenge.active,
        "category": challenge.category,
    }


def completion_json(completion: Completion) -> dict[str, Any]:
    return {
        "id": str(completion.id),
        "profile_id": str(completion.profile_id),
        "challenge_id": str(completion.challenge_id),
        "completed_on": completion.completed_on.isoformat(),
        "created_at": utc_z(completion.created_at),
        "challenge": challenge_json(completion.challenge),
        "points": completion.challenge.points,
    }


def get_profile_or_404(db: Session, profile_id: uuid.UUID) -> Profile:
    profile = db.get(Profile, profile_id)
    if profile is None:
        raise ApiError(404, "PROFILE_NOT_FOUND", "Profile not found")
    return profile


app = FastAPI(title="WattWise LiFE API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(ApiError)
async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
    return error_response(exc.status_code, exc.code, exc.message, exc.details)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        {"loc": list(item.get("loc", ())), "message": item.get("msg", "Invalid input"), "type": item.get("type", "validation_error")}
        for item in exc.errors()
    ]
    return error_response(422, "VALIDATION_ERROR", "Request validation failed", details)


@app.exception_handler(Exception)
async def handle_unexpected_error(_: Request, __: Exception) -> JSONResponse:
    return error_response(500, "INTERNAL_ERROR", "An unexpected server error occurred")


@app.post("/api/v1/profiles", status_code=status.HTTP_201_CREATED)
def create_profile(payload: ProfileCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    profile = Profile(display_name=payload.display_name, city=payload.city, household_size=payload.household_size)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile_json(profile)


@app.get("/api/v1/profiles/{profile_id}")
def get_profile(profile_id: uuid.UUID, db: Session = Depends(get_db)) -> dict[str, Any]:
    return profile_json(get_profile_or_404(db, profile_id))


@app.post("/api/v1/profiles/{profile_id}/energy-entries", status_code=status.HTTP_201_CREATED)
def create_energy_entry(profile_id: uuid.UUID, payload: EnergyEntryCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    get_profile_or_404(db, profile_id)
    entry = EnergyEntry(
        profile_id=profile_id,
        period_month=payload.period_month,
        electricity_kwh=Decimal(payload.electricity_kwh),
    )
    db.add(entry)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(409, "ENTRY_EXISTS", "An electricity entry already exists for this month") from exc
    db.refresh(entry)
    return energy_json(entry)


@app.get("/api/v1/profiles/{profile_id}/energy-entries")
def list_energy_entries(
    profile_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    get_profile_or_404(db, profile_id)
    total = db.scalar(select(func.count()).select_from(EnergyEntry).where(EnergyEntry.profile_id == profile_id)) or 0
    entries = db.scalars(
        select(EnergyEntry)
        .where(EnergyEntry.profile_id == profile_id)
        .order_by(EnergyEntry.period_month.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return {"items": [energy_json(item) for item in entries], "limit": limit, "offset": offset, "total": total}


@app.post("/api/v1/profiles/{profile_id}/water-entries", status_code=status.HTTP_201_CREATED)
def create_water_entry(profile_id: uuid.UUID, payload: WaterEntryCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    get_profile_or_404(db, profile_id)
    entry = WaterEntry(profile_id=profile_id, month=payload.month, litres=Decimal(payload.litres))
    db.add(entry)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(409, "WATER_ENTRY_EXISTS", "A water entry already exists for this month") from exc
    db.refresh(entry)
    return water_json(entry)


@app.get("/api/v1/profiles/{profile_id}/water-entries")
def list_water_entries(
    profile_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    get_profile_or_404(db, profile_id)
    total = db.scalar(select(func.count()).select_from(WaterEntry).where(WaterEntry.profile_id == profile_id)) or 0
    entries = db.scalars(
        select(WaterEntry)
        .where(WaterEntry.profile_id == profile_id)
        .order_by(WaterEntry.month.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return {"items": [water_json(item) for item in entries], "limit": limit, "offset": offset, "total": total}


@app.get("/api/v1/profiles/{profile_id}/water-summary")
def get_water_summary(profile_id: uuid.UUID, db: Session = Depends(get_db)) -> dict[str, Any]:
    profile = get_profile_or_404(db, profile_id)
    entries = db.scalars(
        select(WaterEntry).where(WaterEntry.profile_id == profile_id).order_by(WaterEntry.month.asc())
    ).all()
    if not entries:
        return {
            "latest_month": None,
            "latest_month_litres": None,
            "daily_household_average_litres": None,
            "per_person_daily_average_litres": None,
            "previous_month_litres": None,
            "month_over_month_change_percent": None,
            "monthly_history": [],
        }

    latest = entries[-1]
    days = monthrange(latest.month.year, latest.month.month)[1]
    daily_average = Decimal(latest.litres) / Decimal(days)
    previous_year = latest.month.year if latest.month.month > 1 else latest.month.year - 1
    previous_month_number = latest.month.month - 1 if latest.month.month > 1 else 12
    previous_month_date = latest.month.replace(year=previous_year, month=previous_month_number)
    previous = next((item for item in entries if item.month == previous_month_date), None)
    change = None
    if previous is not None:
        change = latest_change_percent(latest.litres, previous.litres)

    return {
        "latest_month": latest.month.isoformat(),
        "latest_month_litres": decimal_2(latest.litres),
        "daily_household_average_litres": water_daily_average(latest.litres, days),
        "per_person_daily_average_litres": (
            decimal_2(daily_average / Decimal(profile.household_size)) if profile.household_size else None
        ),
        "previous_month_litres": decimal_2(previous.litres) if previous else None,
        "month_over_month_change_percent": change,
        "monthly_history": [water_json(item) for item in entries],
    }


@app.get("/api/v1/profiles/{profile_id}/footprint")
def get_footprint(profile_id: uuid.UUID, db: Session = Depends(get_db)) -> dict[str, Any]:
    get_profile_or_404(db, profile_id)
    entries = db.scalars(
        select(EnergyEntry).where(EnergyEntry.profile_id == profile_id).order_by(EnergyEntry.period_month.asc())
    ).all()
    change = None
    if len(entries) >= 2:
        change = latest_change_percent(entries[-1].electricity_kwh, entries[-2].electricity_kwh)
    return {
        "profile_id": str(profile_id),
        "emissions_factor_kg_per_kwh": decimal_4(settings.emissions_factor_kg_per_kwh),
        "items": [
            {
                "period_month": item.period_month.isoformat(),
                "electricity_kwh": decimal_2(item.electricity_kwh),
                "estimated_kg_co2e": decimal_2(footprint_value(item.electricity_kwh, settings.emissions_factor_kg_per_kwh)),
            }
            for item in entries
        ],
        "latest_change_percent": change,
        "assumption_note": (
            "Uses an illustrative configurable demo factor of 0.7000 kg CO2e per kWh; "
            "this is not a verified regional or grid emissions factor and does not represent measured savings."
        ),
    }


@app.get("/api/v1/challenges")
def list_challenges(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    active_filter = Challenge.active.is_(True)
    total = db.scalar(select(func.count()).select_from(Challenge).where(active_filter)) or 0
    challenges = db.scalars(
        select(Challenge).where(active_filter).order_by(Challenge.code.asc()).limit(limit).offset(offset)
    ).all()
    return {"items": [challenge_json(item) for item in challenges], "limit": limit, "offset": offset, "total": total}


@app.post("/api/v1/profiles/{profile_id}/completions", status_code=status.HTTP_201_CREATED)
def create_completion(profile_id: uuid.UUID, payload: CompletionCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    get_profile_or_404(db, profile_id)
    challenge = db.get(Challenge, payload.challenge_id)
    if challenge is None or not challenge.active:
        raise ApiError(404, "CHALLENGE_NOT_FOUND", "Active challenge not found")
    completion = Completion(profile_id=profile_id, challenge_id=challenge.id, completed_on=payload.completed_on)
    completion.challenge = challenge
    db.add(completion)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(409, "ALREADY_COMPLETED", "This challenge is already completed for that date") from exc
    db.refresh(completion)
    return completion_json(completion)


@app.get("/api/v1/profiles/{profile_id}/completions")
def list_completions(
    profile_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    get_profile_or_404(db, profile_id)
    total = db.scalar(select(func.count()).select_from(Completion).where(Completion.profile_id == profile_id)) or 0
    completions = db.scalars(
        select(Completion)
        .options(joinedload(Completion.challenge))
        .where(Completion.profile_id == profile_id)
        .order_by(Completion.completed_on.desc(), Completion.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return {"items": [completion_json(item) for item in completions], "limit": limit, "offset": offset, "total": total}


@app.get("/api/v1/leaderboard")
def get_leaderboard(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    points = func.coalesce(func.sum(Challenge.points), 0).label("points")
    completed_count = func.count(Completion.id).label("completed_count")
    query = (
        select(Profile.id, Profile.display_name, points, completed_count)
        .outerjoin(Completion, Completion.profile_id == Profile.id)
        .outerjoin(Challenge, Challenge.id == Completion.challenge_id)
        .group_by(Profile.id, Profile.display_name)
        .order_by(points.desc(), Profile.display_name.asc(), Profile.id.asc())
        .limit(limit)
        .offset(offset)
    )
    rows = db.execute(query).all()
    total = db.scalar(select(func.count()).select_from(Profile)) or 0
    return {
        "items": [
            {
                "profile_id": str(row.id),
                "display_name": row.display_name,
                "points": int(row.points),
                "completed_count": int(row.completed_count),
            }
            for row in rows
        ],
        "limit": limit,
        "offset": offset,
        "total": total,
    }


@app.get("/api/v1/profiles/{profile_id}/nudges")
def get_nudges(profile_id: uuid.UUID, db: Session = Depends(get_db)) -> dict[str, Any]:
    get_profile_or_404(db, profile_id)
    values = db.scalars(
        select(EnergyEntry.electricity_kwh)
        .where(EnergyEntry.profile_id == profile_id)
        .order_by(EnergyEntry.period_month.desc())
        .limit(2)
    ).all()
    return {"items": personalized_nudges(list(values))}


@app.get("/api/v1/profiles/{profile_id}/achievements")
def get_achievements(profile_id: uuid.UUID, db: Session = Depends(get_db)) -> dict[str, Any]:
    get_profile_or_404(db, profile_id)
    completed_count = db.scalar(
        select(func.count()).select_from(Completion).where(Completion.profile_id == profile_id)
    ) or 0
    water_completion_count = db.scalar(
        select(func.count())
        .select_from(Completion)
        .join(Challenge, Challenge.id == Completion.challenge_id)
        .where(Completion.profile_id == profile_id, Challenge.category == "WATER")
    ) or 0
    energy_month_count = db.scalar(
        select(func.count(func.distinct(EnergyEntry.period_month))).where(EnergyEntry.profile_id == profile_id)
    ) or 0
    points = db.scalar(
        select(func.coalesce(func.sum(Challenge.points), 0))
        .select_from(Completion)
        .join(Challenge, Challenge.id == Completion.challenge_id)
        .where(Completion.profile_id == profile_id)
    ) or 0
    metrics = {
        "completed_count": int(completed_count),
        "water_completion_count": int(water_completion_count),
        "energy_month_count": int(energy_month_count),
        "points": int(points),
    }
    return {"items": calculate_achievements(metrics)}


@app.get("/api/v1/profiles/{profile_id}/streak")
def get_streak(profile_id: uuid.UUID, db: Session = Depends(get_db)) -> dict[str, Any]:
    get_profile_or_404(db, profile_id)
    active_dates = db.scalars(
        select(Completion.completed_on)
        .where(Completion.profile_id == profile_id)
        .distinct()
        .order_by(Completion.completed_on.asc())
    ).all()
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    return calculate_streak(list(active_dates), today)


@app.post("/api/v1/solar/estimate")
def estimate_solar(payload: SolarEstimateCreate) -> dict[str, object]:
    return solar_estimate(Decimal(payload.roof_area_m2), Decimal(payload.electricity_tariff_inr_per_kwh))

