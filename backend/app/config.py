from __future__ import annotations

import os
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from sqlalchemy.engine import make_url


class ConfigurationError(RuntimeError):
    """Raised when required runtime configuration is unsafe or missing."""


@dataclass(frozen=True)
class Settings:
    database_url: str
    emissions_factor_kg_per_kwh: Decimal
    test_schema: str | None = None


def database_name(database_url: str) -> str:
    try:
        name = make_url(database_url).database
    except Exception as exc:  # pragma: no cover - SQLAlchemy supplies details
        raise ConfigurationError("DATABASE_URL is not a valid SQLAlchemy URL") from exc
    if not name:
        raise ConfigurationError("DATABASE_URL must name a PostgreSQL database")
    return name


def require_test_database(database_url: str) -> None:
    name = database_name(database_url)
    if name != "wattwise_test":
        raise ConfigurationError(
            "Backend tests may only use the PostgreSQL database 'wattwise_test'; "
            f"configured database is {name!r}."
        )


def load_settings() -> Settings:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise ConfigurationError("DATABASE_URL must be configured")
    if not database_url.startswith(("postgresql://", "postgresql+psycopg2://")):
        raise ConfigurationError("WattWise LiFE requires PostgreSQL")

    factor_text = os.getenv("EMISSIONS_FACTOR_KG_PER_KWH", "0.7000").strip()
    try:
        factor = Decimal(factor_text)
    except InvalidOperation as exc:
        raise ConfigurationError("EMISSIONS_FACTOR_KG_PER_KWH must be decimal") from exc
    if not factor.is_finite() or factor < 0:
        raise ConfigurationError("EMISSIONS_FACTOR_KG_PER_KWH must be finite and nonnegative")

    schema = os.getenv("TEST_SCHEMA", "").strip() or None
    if schema and not schema.replace("_", "").isalnum():
        raise ConfigurationError("TEST_SCHEMA contains unsupported characters")
    return Settings(database_url=database_url, emissions_factor_kg_per_kwh=factor, test_schema=schema)


settings = load_settings()

