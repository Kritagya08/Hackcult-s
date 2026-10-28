from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP


TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")
AREA_M2_PER_KWP = Decimal("6.00")
DAILY_KWH_PER_KWP = Decimal("4.00")
DAYS_PER_YEAR = Decimal("365")


def q2(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def q4(value: Decimal) -> Decimal:
    return value.quantize(FOUR_PLACES, rounding=ROUND_HALF_UP)


def decimal_2(value: Decimal) -> str:
    return format(q2(value), ".2f")


def decimal_4(value: Decimal) -> str:
    return format(q4(value), ".4f")


def footprint_value(kwh: Decimal, factor: Decimal) -> Decimal:
    return q2(kwh * factor)


def latest_change_percent(latest: Decimal, previous: Decimal) -> str | None:
    if previous == 0:
        return None
    return decimal_2(((latest - previous) / previous) * Decimal("100"))


def water_daily_average(litres: Decimal, days_in_month: int) -> str:
    return decimal_2(litres / Decimal(days_in_month))


ACHIEVEMENTS = (
    {
        "id": "green_beginner",
        "title": "Green Beginner",
        "description": "Complete 1 challenge.",
        "metric": "completed_count",
        "target": 1,
    },
    {
        "id": "water_guardian",
        "title": "Water Guardian",
        "description": "Complete 5 water-category challenges.",
        "metric": "water_completion_count",
        "target": 5,
    },
    {
        "id": "energy_saver",
        "title": "Energy Saver",
        "description": "Record electricity consumption for 3 distinct months.",
        "metric": "energy_month_count",
        "target": 3,
    },
    {
        "id": "eco_warrior",
        "title": "Eco Warrior",
        "description": "Earn 200 points.",
        "metric": "points",
        "target": 200,
    },
    {
        "id": "sustainability_champion",
        "title": "Sustainability Champion",
        "description": "Complete 30 challenges.",
        "metric": "completed_count",
        "target": 30,
    },
)


def calculate_achievements(metrics: dict[str, int]) -> list[dict[str, object]]:
    return [
        {
            "id": definition["id"],
            "title": definition["title"],
            "description": definition["description"],
            "unlocked": metrics[definition["metric"]] >= definition["target"],
            "current_progress": metrics[definition["metric"]],
            "target": definition["target"],
        }
        for definition in ACHIEVEMENTS
    ]


def calculate_streak(active_dates: list[date], today: date) -> dict[str, object]:
    distinct_dates = sorted(set(active_dates))
    active_set = set(distinct_dates)

    longest = 0
    run = 0
    previous: date | None = None
    for active_date in distinct_dates:
        if previous is not None and active_date == previous + timedelta(days=1):
            run += 1
        else:
            run = 1
        longest = max(longest, run)
        previous = active_date

    last_active = distinct_dates[-1] if distinct_dates else None
    current = 0
    if last_active in {today, today - timedelta(days=1)}:
        cursor = last_active
        while cursor in active_set:
            current += 1
            cursor -= timedelta(days=1)

    recent_start = today - timedelta(days=6)
    recent = [item.isoformat() for item in distinct_dates if recent_start <= item <= today]
    return {
        "current_streak": current,
        "longest_streak": longest,
        "last_active_date": last_active.isoformat() if last_active else None,
        "active_dates_for_recent_week": recent,
    }


def solar_estimate(roof_area: Decimal, tariff: Decimal) -> dict[str, object]:
    capacity = q2(roof_area / AREA_M2_PER_KWP)
    generation = q2(capacity * DAILY_KWH_PER_KWP * DAYS_PER_YEAR)
    annual_value = q2(generation * tariff)
    return {
        "roof_area_m2": decimal_2(roof_area),
        "estimated_capacity_kwp": decimal_2(capacity),
        "estimated_annual_generation_kwh": decimal_2(generation),
        "estimated_annual_energy_value_inr": decimal_2(annual_value),
        "assumptions": {
            "area_m2_per_kwp": "6.00",
            "daily_kwh_per_kwp": "4.00",
            "days_per_year": 365,
        },
        "disclaimer": (
            "Illustrative only. No assessment of roof orientation, shading, weather, "
            "grid export, tariffs, costs or subsidies."
        ),
    }


def personalized_nudges(values_newest_first: list[Decimal]) -> list[dict[str, str]]:
    if not values_newest_first:
        return [
            {
                "code": "START_TRACKING",
                "title": "Record your first month",
                "message": "Add a monthly electricity reading to establish a household baseline.",
                "reason": "No saved electricity entries are available yet.",
            },
            {
                "code": "SWITCH_OFF_IDLE",
                "title": "Switch off idle devices",
                "message": "Turn off appliances and chargers when they are not in use.",
                "reason": "This is a general Mission LiFE action while a baseline is being established.",
            },
        ]
    if len(values_newest_first) == 1:
        return [
            {
                "code": "BUILD_BASELINE",
                "title": "Add one more month",
                "message": "Record another monthly reading to see whether consumption is changing.",
                "reason": "Only one saved month is available, so no month-to-month comparison is possible.",
            },
            {
                "code": "USE_DAYLIGHT",
                "title": "Use daylight first",
                "message": "Open curtains and use available daylight before switching on lights.",
                "reason": "This is a general low-cost electricity action.",
            },
        ]

    latest, previous = values_newest_first[0], values_newest_first[1]
    if previous == 0:
        return [
            {
                "code": "REVIEW_NEW_USAGE",
                "title": "Review newly recorded usage",
                "message": "Check which appliances were introduced or used more often this month.",
                "reason": "The previous month was zero, so a percentage comparison would be misleading.",
            }
        ]
    change = ((latest - previous) / previous) * Decimal("100")
    change_text = decimal_2(abs(change))
    if change > 0:
        return [
            {
                "code": "USAGE_INCREASED",
                "title": "Electricity use increased",
                "message": "Review high-use appliances and switch off idle devices this month.",
                "reason": f"The latest saved reading is {change_text}% higher than the previous month.",
            }
        ]
    if change < 0:
        return [
            {
                "code": "USAGE_DECREASED",
                "title": "Keep the lower-use habits",
                "message": "Continue the household actions that helped reduce electricity use.",
                "reason": f"The latest saved reading is {change_text}% lower than the previous month.",
            }
        ]
    return [
        {
            "code": "USAGE_STABLE",
            "title": "Try one small reduction",
            "message": "Choose one repeatable action, such as switching off idle devices each evening.",
            "reason": "The latest and previous saved readings are equal.",
        }
    ]

