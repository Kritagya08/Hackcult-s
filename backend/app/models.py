from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (
        CheckConstraint("household_size IS NULL OR household_size > 0", name="ck_profiles_household_size_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    household_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    energy_entries: Mapped[list[EnergyEntry]] = relationship(back_populates="profile", cascade="all, delete-orphan")
    water_entries: Mapped[list[WaterEntry]] = relationship(back_populates="profile", cascade="all, delete-orphan")
    completions: Mapped[list[Completion]] = relationship(back_populates="profile", cascade="all, delete-orphan")


class EnergyEntry(Base):
    __tablename__ = "energy_entries"
    __table_args__ = (
        UniqueConstraint("profile_id", "period_month", name="uq_energy_entries_profile_month"),
        CheckConstraint("electricity_kwh >= 0", name="ck_energy_entries_kwh_nonnegative"),
        Index("ix_energy_entries_profile_month", "profile_id", "period_month"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    period_month: Mapped[date] = mapped_column(Date, nullable=False)
    electricity_kwh: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    profile: Mapped[Profile] = relationship(back_populates="energy_entries")


class WaterEntry(Base):
    __tablename__ = "water_entries"
    __table_args__ = (
        UniqueConstraint("profile_id", "month", name="uq_water_entries_profile_month"),
        CheckConstraint("litres > 0", name="ck_water_entries_litres_positive"),
        Index("ix_water_entries_profile_month", "profile_id", "month"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    month: Mapped[date] = mapped_column(Date, nullable=False)
    litres: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    profile: Mapped[Profile] = relationship(back_populates="water_entries")


class Challenge(Base):
    __tablename__ = "challenges"
    __table_args__ = (
        CheckConstraint("points > 0", name="ck_challenges_points_positive"),
        CheckConstraint("category IN ('ENERGY', 'WATER')", name="ck_challenges_category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    category: Mapped[str] = mapped_column(String(10), nullable=False)

    completions: Mapped[list[Completion]] = relationship(back_populates="challenge")


class Completion(Base):
    __tablename__ = "completions"
    __table_args__ = (
        UniqueConstraint("profile_id", "challenge_id", "completed_on", name="uq_completions_profile_challenge_date"),
        Index("ix_completions_profile_date", "profile_id", "completed_on"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    challenge_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("challenges.id", ondelete="RESTRICT"), nullable=False)
    completed_on: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    profile: Mapped[Profile] = relationship(back_populates="completions")
    challenge: Mapped[Challenge] = relationship(back_populates="completions")

