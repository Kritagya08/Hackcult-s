"""Create Mission LiFE MVP tables and challenge catalog.

Revision ID: 0001_mission_life_mvp
Revises:
Create Date: 2026-10-28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_mission_life_mvp"
down_revision = None
branch_labels = None
depends_on = None


CHALLENGES = [
    {
        "id": "4c204dd0-d9ce-4a8c-9a32-2b7724cc9001",
        "code": "TURN_OFF_UNUSED_LIGHTS",
        "title": "Turn off unused lights",
        "description": "Switch off lights whenever a room is unoccupied.",
        "points": 10,
        "active": True,
    },
    {
        "id": "4c204dd0-d9ce-4a8c-9a32-2b7724cc9002",
        "code": "USE_DAYLIGHT",
        "title": "Use daylight",
        "description": "Use available daylight before switching on electric lighting.",
        "points": 10,
        "active": True,
    },
    {
        "id": "4c204dd0-d9ce-4a8c-9a32-2b7724cc9003",
        "code": "SWITCH_OFF_IDLE_DEVICES",
        "title": "Switch off idle devices",
        "description": "Turn off appliances and chargers that are not being used.",
        "points": 15,
        "active": True,
    },
    {
        "id": "4c204dd0-d9ce-4a8c-9a32-2b7724cc9004",
        "code": "FAN_BEFORE_AC",
        "title": "Try the fan first",
        "description": "Use a fan before air conditioning when conditions allow.",
        "points": 15,
        "active": True,
    },
    {
        "id": "4c204dd0-d9ce-4a8c-9a32-2b7724cc9005",
        "code": "FULL_LOAD_LAUNDRY",
        "title": "Run a full laundry load",
        "description": "Wait for a full load before running the washing machine.",
        "points": 20,
        "active": True,
    },
    {
        "id": "4c204dd0-d9ce-4a8c-9a32-2b7724cc9006",
        "code": "CHECK_AC_SETPOINT",
        "title": "Use a moderate AC setting",
        "description": "Choose a moderate temperature setting instead of maximum cooling.",
        "points": 20,
        "active": True,
    },
]


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.CheckConstraint("points > 0", name="ck_challenges_points_positive"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "energy_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period_month", sa.Date(), nullable=False),
        sa.Column("electricity_kwh", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("electricity_kwh >= 0", name="ck_energy_entries_kwh_nonnegative"),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id", "period_month", name="uq_energy_entries_profile_month"),
    )
    op.create_index("ix_energy_entries_profile_month", "energy_entries", ["profile_id", "period_month"])
    op.create_table(
        "completions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("challenge_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("completed_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["challenge_id"], ["challenges.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id", "challenge_id", "completed_on", name="uq_completions_profile_challenge_date"),
    )
    op.create_index("ix_completions_profile_date", "completions", ["profile_id", "completed_on"])

    challenge_table = sa.table(
        "challenges",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("code", sa.String()),
        sa.column("title", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("points", sa.Integer()),
        sa.column("active", sa.Boolean()),
    )
    op.bulk_insert(challenge_table, CHALLENGES)


def downgrade() -> None:
    op.drop_index("ix_completions_profile_date", table_name="completions")
    op.drop_table("completions")
    op.drop_index("ix_energy_entries_profile_month", table_name="energy_entries")
    op.drop_table("energy_entries")
    op.drop_table("challenges")
    op.drop_table("profiles")

