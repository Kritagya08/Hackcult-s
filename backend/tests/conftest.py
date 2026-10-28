from __future__ import annotations

import os
import re
import sys
import uuid
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

test_database_url = os.getenv("TEST_DATABASE_URL", "").strip()
if not test_database_url:
    raise RuntimeError("TEST_DATABASE_URL is required and must target wattwise_test")
if make_url(test_database_url).database != "wattwise_test":
    raise RuntimeError("Refusing to run: TEST_DATABASE_URL must target wattwise_test")

test_schema = f"wattwise_test_{uuid.uuid4().hex}"
if not re.fullmatch(r"[a-z0-9_]+", test_schema):  # defensive invariant
    raise RuntimeError("Generated test schema is unsafe")

os.environ["DATABASE_URL"] = test_database_url
os.environ["TEST_SCHEMA"] = test_schema
os.environ["EMISSIONS_FACTOR_KG_PER_KWH"] = "0.7000"

admin_engine = create_engine(test_database_url, future=True)
with admin_engine.begin() as connection:
    if connection.scalar(text("select current_database()")) != "wattwise_test":
        raise RuntimeError("Refusing to create test schema outside wattwise_test")
    connection.execute(text(f'CREATE SCHEMA "{test_schema}"'))

alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
command.upgrade(alembic_config, "head")

from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Completion, EnergyEntry, Profile, WaterEntry  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402


@pytest.fixture(scope="session")
def client() -> TestClient:
    with TestClient(app) as value:
        yield value


@pytest.fixture(autouse=True)
def clean_domain_data() -> None:
    with Session(engine) as session:
        session.execute(delete(Completion))
        session.execute(delete(WaterEntry))
        session.execute(delete(EnergyEntry))
        session.execute(delete(Profile))
        session.commit()


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    engine.dispose()
    with admin_engine.begin() as connection:
        if connection.scalar(text("select current_database()")) != "wattwise_test":
            raise RuntimeError("Refusing to clean test schema outside wattwise_test")
        connection.execute(text(f'DROP SCHEMA IF EXISTS "{test_schema}" CASCADE'))
    admin_engine.dispose()

