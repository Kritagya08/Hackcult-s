from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


DecimalString = Annotated[str, StringConstraints(pattern=r"^(0|[1-9]\d*)\.\d{2}$")]
PageLimit = Annotated[int, Field(ge=1, le=100)]
PageOffset = Annotated[int, Field(ge=0)]


def decimal_from_wire(value: str, *, field_name: str, maximum: Decimal) -> Decimal:
    if not isinstance(value, str) or not re.fullmatch(r"(0|[1-9]\d*)\.\d{2}", value):
        raise ValueError(f"{field_name} must be a nonnegative decimal string with exactly 2 digits")
    try:
        result = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError(f"{field_name} is not a valid decimal") from exc
    if not result.is_finite() or result > maximum:
        raise ValueError(f"{field_name} exceeds the supported maximum")
    return result


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ProfileCreate(StrictRequest):
    display_name: str = Field(min_length=1, max_length=80)
    city: str | None = Field(default=None, max_length=100)
    household_size: int | None = Field(default=None, ge=1)

    @field_validator("display_name")
    @classmethod
    def clean_display_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("display_name cannot be blank")
        return value

    @field_validator("city")
    @classmethod
    def clean_city(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class EnergyEntryCreate(StrictRequest):
    period_month: date
    electricity_kwh: DecimalString

    @field_validator("period_month")
    @classmethod
    def require_first_of_month(cls, value: date) -> date:
        if value.day != 1:
            raise ValueError("period_month must be the first day of a calendar month")
        return value

    @field_validator("electricity_kwh")
    @classmethod
    def validate_kwh(cls, value: str) -> str:
        decimal_from_wire(value, field_name="electricity_kwh", maximum=Decimal("9999999999.99"))
        return value


class WaterEntryCreate(StrictRequest):
    month: date
    litres: DecimalString

    @field_validator("month")
    @classmethod
    def require_first_of_month(cls, value: date) -> date:
        if value.day != 1:
            raise ValueError("month must be the first day of a calendar month")
        return value

    @field_validator("litres")
    @classmethod
    def validate_litres(cls, value: str) -> str:
        amount = decimal_from_wire(value, field_name="litres", maximum=Decimal("999999999999.99"))
        if amount <= 0:
            raise ValueError("litres must be positive")
        return value

class CompletionCreate(StrictRequest):
    challenge_id: UUID
    completed_on: date


class SolarEstimateCreate(StrictRequest):
    roof_area_m2: DecimalString
    electricity_tariff_inr_per_kwh: DecimalString

    @field_validator("roof_area_m2")
    @classmethod
    def validate_area(cls, value: str) -> str:
        decimal_from_wire(value, field_name="roof_area_m2", maximum=Decimal("10000.00"))
        return value

    @field_validator("electricity_tariff_inr_per_kwh")
    @classmethod
    def validate_tariff(cls, value: str) -> str:
        decimal_from_wire(value, field_name="electricity_tariff_inr_per_kwh", maximum=Decimal("1000.00"))
        return value


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[Any] = Field(default_factory=list)


class ErrorEnvelope(BaseModel):
    error: ErrorBody

