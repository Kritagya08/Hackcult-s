"""Add Phase 2 water tracking and challenge categories.

Revision ID: 0002_phase2_water
Revises: 0001_mission_life_mvp
Create Date: 2026-10-28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_phase2_water"
down_revision = "0001_mission_life_mvp"
branch_labels = None
depends_on = None


WATER_CHALLENGES = (
    (
        "4c204dd0-d9ce-4a8c-9a32-2b7724cc9101",
        "TURN_OFF_TAP_BRUSHING",
        "Turn Off Tap While Brushing",
        "Turn off the tap while brushing your teeth.",
        10,
    ),
    (
        "4c204dd0-d9ce-4a8c-9a32-2b7724cc9102",
        "SHORTER_SHOWER",
        "Take a Shorter Shower",
        "Reduce shower time where practical.",
        15,
    ),
    (
        "4c204dd0-d9ce-4a8c-9a32-2b7724cc9103",
        "FIX_OR_REPORT_LEAK",
        "Fix or Report a Water Leak",
        "Fix a water leak or report it to the responsible person.",
        20,
    ),
    (
        "4c204dd0-d9ce-4a8c-9a32-2b7724cc9104",
        "REUSE_WATER_FOR_PLANTS",
        "Reuse Suitable Water for Plants",
        "Reuse suitable household water for plants when safe.",
        15,
    ),
    (
        "4c204dd0-d9ce-4a8c-9a32-2b7724cc9105",
        "BUCKET_NOT_RUNNING_HOSE",
        "Use a Bucket Instead of a Running Hose",
        "Use a bucket instead of leaving a hose running.",
        15,
    ),
    (
        "4c204dd0-d9ce-4a8c-9a32-2b7724cc9106",
        "FULL_WASHING_MACHINE_LOAD",
        "Run a Full Washing Machine Load",
        "Wait for a full load before running the washing machine.",
        10,
    ),
)


def upgrade() -> None:
    op.add_column("profiles", sa.Column("household_size", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_profiles_household_size_positive",
        "profiles",
        "household_size IS NULL OR household_size > 0",
    )

    op.add_column(
        "challenges",
        sa.Column("category", sa.String(length=10), server_default="ENERGY", nullable=False),
    )
    op.create_check_constraint(
        "ck_challenges_category",
        "challenges",
        "category IN ('ENERGY', 'WATER')",
    )
    op.alter_column("challenges", "category", server_default=None)

    op.create_table(
        "water_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("litres", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("litres > 0", name="ck_water_entries_litres_positive"),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("profile_id", "month", name="uq_water_entries_profile_month"),
    )
    op.create_index("ix_water_entries_profile_month", "water_entries", ["profile_id", "month"])

    for challenge_id, code, title, description, points in WATER_CHALLENGES:
        op.execute(
            sa.text(
                """
                INSERT INTO challenges (id, code, title, description, points, active, category)
                VALUES (CAST(:id AS uuid), :code, :title, :description, :points, true, 'WATER')
                ON CONFLICT (code) DO NOTHING
                """
            ).bindparams(
                id=challenge_id,
                code=code,
                title=title,
                description=description,
                points=points,
            )
        )


def downgrade() -> None:
    quoted_codes = ", ".join(f"'{item[1]}'" for item in WATER_CHALLENGES)
    op.execute(sa.text(f"DELETE FROM challenges WHERE code IN ({quoted_codes})"))
    op.drop_index("ix_water_entries_profile_month", table_name="water_entries")
    op.drop_table("water_entries")
    op.drop_constraint("ck_challenges_category", "challenges", type_="check")
    op.drop_column("challenges", "category")
    op.drop_constraint("ck_profiles_household_size_positive", "profiles", type_="check")
    op.drop_column("profiles", "household_size")
