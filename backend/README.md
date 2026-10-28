# WattWise LiFE backend

The backend implements the 11 frozen Mission LiFE MVP endpoints with FastAPI,
SQLAlchemy, Alembic, and PostgreSQL, plus the additive Phase 2 water,
achievement, and streak endpoints.

## Phase 2 API additions

- `POST /api/v1/profiles/{profile_id}/water-entries`
- `GET /api/v1/profiles/{profile_id}/water-entries?limit=50&offset=0`
- `GET /api/v1/profiles/{profile_id}/water-summary`
- `GET /api/v1/profiles/{profile_id}/achievements`
- `GET /api/v1/profiles/{profile_id}/streak`

Profile creation accepts an optional positive integer `household_size`. Existing
profiles and new profiles that omit it retain `NULL`; their water summary returns
`per_person_daily_average_litres: null`. The established profile response shape
is unchanged.

Challenges now include `category`, either `ENERGY` or `WATER`. The original six
challenge rows are migrated to `ENERGY` without changing their IDs. Six stable,
idempotently seeded water challenges are added as `WATER`.

Achievement status is derived from persisted entries and completions. Because
unlock events are not stored, achievement responses intentionally omit
`unlocked_at`. Streak calendar dates use `Asia/Kolkata`.

## Local startup

From `backend/`, set `DATABASE_URL` to the local PostgreSQL `wattwise` database,
then run:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Tests require `TEST_DATABASE_URL` whose database name is exactly
`wattwise_test`. They create and remove a unique temporary schema so existing
test-database contents are not reused or overwritten.

