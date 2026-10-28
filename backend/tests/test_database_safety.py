from __future__ import annotations

import pytest

from app.config import ConfigurationError, require_test_database


def test_test_configuration_rejects_production_database() -> None:
    with pytest.raises(ConfigurationError, match="wattwise_test"):
        require_test_database("postgresql+psycopg2://user:password@127.0.0.1:5432/wattwise")


def test_test_configuration_accepts_only_test_database() -> None:
    require_test_database("postgresql+psycopg2://user:password@127.0.0.1:5432/wattwise_test")

