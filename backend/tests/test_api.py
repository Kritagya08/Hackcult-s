from __future__ import annotations

from uuid import UUID

from alembic import command
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select, func
from sqlalchemy.orm import Session

from app.database import engine
from app.models import Challenge
from tests.conftest import alembic_config


def create_profile(client: TestClient, name: str = "Asha") -> dict:
    response = client.post("/api/v1/profiles", json={"display_name": name, "city": "Gandhinagar"})
    assert response.status_code == 201, response.text
    return response.json()


def test_preserves_eleven_contract_routes_and_adds_five_phase_two_routes() -> None:
    contract_routes = {
        (method, route.path)
        for route in __import__("app.main", fromlist=["app"]).app.routes
        for method in getattr(route, "methods", set())
        if route.path.startswith("/api/v1") and method in {"GET", "POST"}
    }
    assert len(contract_routes) == 16


def test_fresh_migration_and_repeatable_seed() -> None:
    command.upgrade(alembic_config, "head")
    tables = set(inspect(engine).get_table_names())
    assert {"profiles", "energy_entries", "water_entries", "challenges", "completions"}.issubset(tables)
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(Challenge)) == 12
        assert session.scalar(
            select(func.count()).select_from(Challenge).where(Challenge.category == "ENERGY")
        ) == 6
        assert session.scalar(
            select(func.count()).select_from(Challenge).where(Challenge.category == "WATER")
        ) == 6
        existing = session.scalar(select(Challenge).where(Challenge.code == "TURN_OFF_UNUSED_LIGHTS"))
        assert existing is not None
        assert str(existing.id) == "4c204dd0-d9ce-4a8c-9a32-2b7724cc9001"
        assert existing.category == "ENERGY"


def test_profile_energy_and_footprint_end_to_end(client: TestClient) -> None:
    profile = create_profile(client)
    UUID(profile["id"])
    assert profile["created_at"].endswith("Z")

    fetched = client.get(f"/api/v1/profiles/{profile['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == profile

    first = client.post(
        f"/api/v1/profiles/{profile['id']}/energy-entries",
        json={"period_month": "2026-09-01", "electricity_kwh": "200.00"},
    )
    second = client.post(
        f"/api/v1/profiles/{profile['id']}/energy-entries",
        json={"period_month": "2026-10-01", "electricity_kwh": "220.00"},
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["electricity_kwh"] == "220.00"

    duplicate = client.post(
        f"/api/v1/profiles/{profile['id']}/energy-entries",
        json={"period_month": "2026-10-01", "electricity_kwh": "221.00"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "ENTRY_EXISTS"

    history = client.get(f"/api/v1/profiles/{profile['id']}/energy-entries")
    assert history.status_code == 200
    assert history.json()["total"] == 2
    assert [item["period_month"] for item in history.json()["items"]] == ["2026-10-01", "2026-09-01"]

    footprint = client.get(f"/api/v1/profiles/{profile['id']}/footprint")
    assert footprint.status_code == 200
    body = footprint.json()
    assert body["emissions_factor_kg_per_kwh"] == "0.7000"
    assert body["items"][-1] == {
        "period_month": "2026-10-01",
        "electricity_kwh": "220.00",
        "estimated_kg_co2e": "154.00",
    }
    assert body["latest_change_percent"] == "10.00"
    assert "illustrative" in body["assumption_note"].lower()


def test_validation_and_unknown_profile_errors(client: TestClient) -> None:
    profile = create_profile(client)
    invalid = client.post(
        f"/api/v1/profiles/{profile['id']}/energy-entries",
        json={"period_month": "2026-10-02", "electricity_kwh": "1.234"},
    )
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "VALIDATION_ERROR"
    assert isinstance(invalid.json()["error"]["details"], list)

    extra_field = client.post(
        "/api/v1/profiles",
        json={"display_name": "Asha", "city": "Gandhinagar", "points": 999},
    )
    assert extra_field.status_code == 422
    assert extra_field.json()["error"]["code"] == "VALIDATION_ERROR"

    missing = client.get("/api/v1/profiles/00000000-0000-0000-0000-000000000000")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "PROFILE_NOT_FOUND"


def test_challenges_completion_points_and_leaderboard(client: TestClient) -> None:
    profile = create_profile(client)
    challenges = client.get("/api/v1/challenges")
    assert challenges.status_code == 200
    assert challenges.json()["total"] == 12
    challenge = challenges.json()["items"][0]
    assert challenge["category"] in {"ENERGY", "WATER"}

    payload = {"challenge_id": challenge["id"], "completed_on": "2026-10-27"}
    created = client.post(f"/api/v1/profiles/{profile['id']}/completions", json=payload)
    assert created.status_code == 201
    assert created.json()["points"] == challenge["points"]
    assert created.json()["challenge"]["code"] == challenge["code"]

    duplicate = client.post(f"/api/v1/profiles/{profile['id']}/completions", json=payload)
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "ALREADY_COMPLETED"

    completions = client.get(f"/api/v1/profiles/{profile['id']}/completions")
    assert completions.status_code == 200
    assert completions.json()["total"] == 1

    leaderboard = client.get("/api/v1/leaderboard")
    assert leaderboard.status_code == 200
    assert leaderboard.json()["items"][0] == {
        "profile_id": profile["id"],
        "display_name": "Asha",
        "points": challenge["points"],
        "completed_count": 1,
    }


def test_nudges_change_with_persisted_consumption(client: TestClient) -> None:
    profile = create_profile(client)
    initial = client.get(f"/api/v1/profiles/{profile['id']}/nudges")
    assert initial.status_code == 200
    assert initial.json()["items"][0]["code"] == "START_TRACKING"

    for month, value in (("2026-09-01", "100.00"), ("2026-10-01", "125.00")):
        response = client.post(
            f"/api/v1/profiles/{profile['id']}/energy-entries",
            json={"period_month": month, "electricity_kwh": value},
        )
        assert response.status_code == 201
    changed = client.get(f"/api/v1/profiles/{profile['id']}/nudges")
    assert changed.json()["items"][0]["code"] == "USAGE_INCREASED"
    assert "25.00%" in changed.json()["items"][0]["reason"]


def test_solar_decimal_calculation_and_bounds(client: TestClient) -> None:
    response = client.post(
        "/api/v1/solar/estimate",
        json={"roof_area_m2": "30.00", "electricity_tariff_inr_per_kwh": "8.00"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "roof_area_m2": "30.00",
        "estimated_capacity_kwp": "5.00",
        "estimated_annual_generation_kwh": "7300.00",
        "estimated_annual_energy_value_inr": "58400.00",
        "assumptions": {"area_m2_per_kwp": "6.00", "daily_kwh_per_kwp": "4.00", "days_per_year": 365},
        "disclaimer": "Illustrative only. No assessment of roof orientation, shading, weather, grid export, tariffs, costs or subsidies.",
    }

    invalid = client.post(
        "/api/v1/solar/estimate",
        json={"roof_area_m2": "30.001", "electricity_tariff_inr_per_kwh": "NaN"},
    )
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "VALIDATION_ERROR"


def test_cors_for_frontend_origin(client: TestClient) -> None:
    response = client.options(
        "/api/v1/challenges",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"

