from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient


def create_profile(client: TestClient, name: str = "Neel", household_size: int | None = None) -> dict:
    payload: dict[str, object] = {"display_name": name, "city": "Pune"}
    if household_size is not None:
        payload["household_size"] = household_size
    response = client.post("/api/v1/profiles", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def challenge_by_code(client: TestClient, code: str) -> dict:
    response = client.get("/api/v1/challenges?limit=100&offset=0")
    assert response.status_code == 200
    return next(item for item in response.json()["items"] if item["code"] == code)


def complete(client: TestClient, profile_id: str, challenge_id: str, completed_on: str) -> dict:
    response = client.post(
        f"/api/v1/profiles/{profile_id}/completions",
        json={"challenge_id": challenge_id, "completed_on": completed_on},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_water_entry_creation_retrieval_and_duplicate(client: TestClient) -> None:
    profile = create_profile(client)
    created = client.post(
        f"/api/v1/profiles/{profile['id']}/water-entries",
        json={"month": "2026-10-01", "litres": "12000.00"},
    )
    assert created.status_code == 201
    assert created.json()["litres"] == "12000.00"
    assert created.json()["month"] == "2026-10-01"

    duplicate = client.post(
        f"/api/v1/profiles/{profile['id']}/water-entries",
        json={"month": "2026-10-01", "litres": "11999.00"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "WATER_ENTRY_EXISTS"

    second = client.post(
        f"/api/v1/profiles/{profile['id']}/water-entries",
        json={"month": "2026-09-01", "litres": "11000.00"},
    )
    assert second.status_code == 201
    history = client.get(f"/api/v1/profiles/{profile['id']}/water-entries")
    assert history.status_code == 200
    assert history.json()["total"] == 2
    assert [item["month"] for item in history.json()["items"]] == ["2026-10-01", "2026-09-01"]


def test_water_summary_leap_year_and_month_over_month(client: TestClient) -> None:
    profile = create_profile(client, household_size=4)
    for month, litres in (("2024-01-01", "3100.00"), ("2024-02-01", "2900.00")):
        response = client.post(
            f"/api/v1/profiles/{profile['id']}/water-entries",
            json={"month": month, "litres": litres},
        )
        assert response.status_code == 201

    summary = client.get(f"/api/v1/profiles/{profile['id']}/water-summary")
    assert summary.status_code == 200
    body = summary.json()
    assert body["latest_month"] == "2024-02-01"
    assert body["latest_month_litres"] == "2900.00"
    assert body["daily_household_average_litres"] == "100.00"
    assert body["per_person_daily_average_litres"] == "25.00"
    assert body["previous_month_litres"] == "3100.00"
    assert body["month_over_month_change_percent"] == "-6.45"
    assert [item["month"] for item in body["monthly_history"]] == ["2024-01-01", "2024-02-01"]


def test_water_validation_unknown_profile_and_missing_history(client: TestClient) -> None:
    profile = create_profile(client)
    empty = client.get(f"/api/v1/profiles/{profile['id']}/water-summary")
    assert empty.status_code == 200
    assert empty.json() == {
        "latest_month": None,
        "latest_month_litres": None,
        "daily_household_average_litres": None,
        "per_person_daily_average_litres": None,
        "previous_month_litres": None,
        "month_over_month_change_percent": None,
        "monthly_history": [],
    }

    invalid_payloads = (
        {"month": "2026-10-02", "litres": "100.00"},
        {"month": "2026-10-01", "litres": "0.00"},
        {"month": "2026-10-01", "litres": "-1.00"},
        {"month": "2026-10-01", "litres": "1.001"},
        {"month": "2026-10-01", "litres": "1.00", "savings": "1.00"},
    )
    for payload in invalid_payloads:
        response = client.post(f"/api/v1/profiles/{profile['id']}/water-entries", json=payload)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"

    missing = client.post(
        "/api/v1/profiles/00000000-0000-0000-0000-000000000000/water-entries",
        json={"month": "2026-10-01", "litres": "100.00"},
    )
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "PROFILE_NOT_FOUND"

    gap_profile = create_profile(client, name="Gap")
    for month in ("2026-08-01", "2026-10-01"):
        response = client.post(
            f"/api/v1/profiles/{gap_profile['id']}/water-entries",
            json={"month": month, "litres": "3100.00"},
        )
        assert response.status_code == 201
    gap_summary = client.get(f"/api/v1/profiles/{gap_profile['id']}/water-summary").json()
    assert gap_summary["previous_month_litres"] is None
    assert gap_summary["month_over_month_change_percent"] is None


def test_energy_and_water_challenge_compatibility(client: TestClient) -> None:
    profile = create_profile(client)
    energy = challenge_by_code(client, "TURN_OFF_UNUSED_LIGHTS")
    water = challenge_by_code(client, "TURN_OFF_TAP_BRUSHING")
    assert energy["category"] == "ENERGY"
    assert water["category"] == "WATER"

    energy_completion = complete(client, profile["id"], energy["id"], "2026-10-27")
    water_completion = complete(client, profile["id"], water["id"], "2026-10-27")
    assert energy_completion["points"] == 10
    assert water_completion["points"] == 10
    assert water_completion["challenge"]["category"] == "WATER"

    duplicate = client.post(
        f"/api/v1/profiles/{profile['id']}/completions",
        json={"challenge_id": water["id"], "completed_on": "2026-10-27"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "ALREADY_COMPLETED"


def test_achievement_unlocking_uses_persisted_data(client: TestClient) -> None:
    profile = create_profile(client)
    challenges = client.get("/api/v1/challenges?limit=100").json()["items"]
    water_challenges = [item for item in challenges if item["category"] == "WATER"]

    for month in ("2026-08-01", "2026-09-01", "2026-10-01"):
        response = client.post(
            f"/api/v1/profiles/{profile['id']}/energy-entries",
            json={"period_month": month, "electricity_kwh": "100.00"},
        )
        assert response.status_code == 201
    for challenge in water_challenges[:5]:
        complete(client, profile["id"], challenge["id"], "2026-10-27")

    achievements = client.get(f"/api/v1/profiles/{profile['id']}/achievements")
    assert achievements.status_code == 200
    by_id = {item["id"]: item for item in achievements.json()["items"]}
    assert by_id["green_beginner"]["unlocked"] is True
    assert by_id["water_guardian"]["current_progress"] == 5
    assert by_id["water_guardian"]["unlocked"] is True
    assert by_id["energy_saver"]["unlocked"] is True
    assert by_id["eco_warrior"]["unlocked"] is False
    assert "unlocked_at" not in by_id["green_beginner"]

    for day_offset in range(1, 6):
        for challenge in challenges:
            complete(client, profile["id"], challenge["id"], f"2026-11-{day_offset:02d}")
    updated = client.get(f"/api/v1/profiles/{profile['id']}/achievements").json()["items"]
    updated_by_id = {item["id"]: item for item in updated}
    assert updated_by_id["eco_warrior"]["unlocked"] is True
    assert updated_by_id["sustainability_champion"]["unlocked"] is True


def test_streaks_use_distinct_kolkata_dates_and_cross_months(client: TestClient) -> None:
    profile = create_profile(client)
    first = challenge_by_code(client, "TURN_OFF_UNUSED_LIGHTS")
    second = challenge_by_code(client, "USE_DAYLIGHT")
    for completed_on in ("2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"):
        complete(client, profile["id"], first["id"], completed_on)
    complete(client, profile["id"], second["id"], "2026-10-02")

    historical = client.get(f"/api/v1/profiles/{profile['id']}/streak")
    assert historical.status_code == 200
    assert historical.json()["longest_streak"] == 4
    assert historical.json()["current_streak"] == 0
    assert historical.json()["last_active_date"] == "2026-10-02"

    current_profile = create_profile(client, name="Current")
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    yesterday = today - timedelta(days=1)
    complete(client, current_profile["id"], first["id"], yesterday.isoformat())
    complete(client, current_profile["id"], first["id"], today.isoformat())
    complete(client, current_profile["id"], second["id"], today.isoformat())
    current = client.get(f"/api/v1/profiles/{current_profile['id']}/streak").json()
    assert current["current_streak"] == 2
    assert current["longest_streak"] == 2
    assert current["active_dates_for_recent_week"] == [yesterday.isoformat(), today.isoformat()]

    missed_profile = create_profile(client, name="Missed")
    complete(client, missed_profile["id"], first["id"], (today - timedelta(days=2)).isoformat())
    missed = client.get(f"/api/v1/profiles/{missed_profile['id']}/streak").json()
    assert missed["current_streak"] == 0
