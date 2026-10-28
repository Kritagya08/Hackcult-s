# WattWise LiFE

> Interactive Mission LiFE citizen engagement for tracking household resource use, adopting sustainable habits, and understanding illustrative clean-energy opportunities.

**HackCult 2026 · Problem statement HC26-GEDA01 · Solo development**

## Problem overview

Households often receive electricity and water bills without a simple way to observe trends, connect daily habits to resource use, or stay motivated to act. Sustainability information can also become misleading when estimates are presented as measured savings.

WattWise LiFE addresses this engagement gap with a local-first citizen application that separates recorded household data, deterministic calculations, self-reported actions, and illustrative estimates.

## Proposed solution

WattWise LiFE combines five focused modules in a responsive React interface backed by a typed FastAPI API and PostgreSQL. A citizen creates a lightweight household profile, records monthly electricity and water consumption, completes Mission LiFE challenges, follows community progress, earns deterministic badges, maintains an activity streak, and explores an assumption-based rooftop solar estimate.

The application does not claim causal savings, audited carbon reductions, or production-grade solar feasibility. Calculations disclose their assumptions.

## Key features

- **My Footprint** — records monthly electricity consumption, charts usage, calculates month-to-month change, and estimates carbon footprint with a configurable illustrative emissions factor.
- **Water Tracker** — records monthly water consumption, calculates household and optional per-person daily averages, compares consecutive months, and visualizes history.
- **Green Actions** — presents 12 seeded sustainability challenges: six energy and six water actions. Completions are deduplicated per profile, challenge, and date; points are calculated by the server.
- **Community Impact** — shows a points leaderboard, five progress-based achievements, completion history, and daily streaks interpreted using the Asia/Kolkata calendar.
- **Solar Explorer** — estimates rooftop capacity, annual generation, and illustrative annual energy value from roof area and electricity tariff.
- Strict decimal-string request validation and normalized API error envelopes.
- PostgreSQL constraints, foreign keys, unique constraints, and additive Alembic migrations.
- Responsive dark-navy and emerald interface using Recharts for consumption trends.

## Citizen engagement workflow

1. Create a household profile with an optional city and household size.
2. Record monthly electricity and water consumption.
3. Review trends, averages, and clearly labeled estimates.
4. Choose an energy or water conservation challenge.
5. Log completed actions and earn server-derived points.
6. Track leaderboard position, achievement progress, and daily streaks.
7. Explore illustrative rooftop solar potential using disclosed assumptions.

## Technical architecture

WattWise LiFE is a modular monolith:

```text
Citizen browser
  → React + TypeScript + Vite frontend
  → Typed REST client at /api/v1
  → FastAPI routes and Pydantic validation
  → Deterministic domain services
  → SQLAlchemy ORM
  → PostgreSQL
```

FastAPI owns validation and calculations; the frontend renders server-authoritative results. SQLAlchemy models enforce relationships and Alembic manages the two implemented revisions. See [the detailed architecture](docs/MISSION_LIFE_ARCHITECTURE.md).

## Technology stack

- **Frontend:** React 18, TypeScript, Vite, Recharts, Lucide React, plain CSS
- **Backend:** Python 3.13, FastAPI, Pydantic, Uvicorn
- **Persistence:** PostgreSQL 17, SQLAlchemy 2, Alembic, psycopg2
- **Testing:** pytest, FastAPI TestClient/httpx, isolated PostgreSQL test schemas

## Database schema

The implemented data model contains five domain tables:

| Table | Purpose | Important constraints |
|---|---|---|
| `profiles` | Household identity, city, and optional household size | Positive household size when present |
| `energy_entries` | Monthly electricity consumption | Unique profile/month; non-negative kWh |
| `water_entries` | Monthly water consumption | Unique profile/month; positive litres |
| `challenges` | Seeded energy and water actions with server-owned points | Unique code; positive points; `ENERGY` or `WATER` category |
| `completions` | Self-reported challenge completion dates | Unique profile/challenge/date |

Profiles own energy entries, water entries, and completions. Each completion references one challenge. Achievements, leaderboard values, nudges, footprints, summaries, and streaks are calculated from these persisted records rather than stored as separate tables.

## API endpoints

The backend exposes 16 endpoints under `http://127.0.0.1:8000/api/v1`:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/profiles` | Create a household profile |
| `GET` | `/profiles/{profile_id}` | Retrieve a profile |
| `POST` | `/profiles/{profile_id}/energy-entries` | Record monthly electricity use |
| `GET` | `/profiles/{profile_id}/energy-entries` | List electricity history |
| `POST` | `/profiles/{profile_id}/water-entries` | Record monthly water use |
| `GET` | `/profiles/{profile_id}/water-entries` | List water history |
| `GET` | `/profiles/{profile_id}/water-summary` | Calculate water averages and comparison |
| `GET` | `/profiles/{profile_id}/footprint` | Calculate electricity and carbon trend |
| `GET` | `/challenges` | List active energy and water challenges |
| `POST` | `/profiles/{profile_id}/completions` | Record a challenge completion |
| `GET` | `/profiles/{profile_id}/completions` | List profile completions |
| `GET` | `/leaderboard` | Return server-derived community ranking |
| `GET` | `/profiles/{profile_id}/nudges` | Return deterministic energy nudges |
| `GET` | `/profiles/{profile_id}/achievements` | Calculate achievement progress |
| `GET` | `/profiles/{profile_id}/streak` | Calculate current and longest streak |
| `POST` | `/solar/estimate` | Calculate an illustrative solar estimate |

Interactive OpenAPI documentation is available at `http://127.0.0.1:8000/docs` while the backend is running.

## Installation and local setup

### Prerequisites

- Windows 11 or another environment capable of running Python 3.13 and Node.js
- Python 3.13 x64
- Node.js and npm
- PostgreSQL 17
- Git

Create PostgreSQL databases named `wattwise` and `wattwise_test`, and grant the application role access to each database's `public` schema. Keep all credentials outside version control.

### Backend dependencies (PowerShell)

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-test.txt
```

Configure the current PowerShell session without committing credentials:

```powershell
$env:DATABASE_URL = "postgresql+psycopg2://wattwise:<PASSWORD>@127.0.0.1:5432/wattwise"
$env:EMISSIONS_FACTOR_KG_PER_KWH = "0.7000"
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Replace `<PASSWORD>` locally. Do not save the resulting connection string in Git.

### Frontend dependencies

```powershell
cd frontend
npm.cmd install
```

## Running backend and frontend

Start the API from `backend/` after setting `DATABASE_URL`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

In a second PowerShell window, start the frontend from `frontend/`:

```powershell
npm.cmd run dev
```

Open `http://localhost:5173`. The backend CORS policy permits the local Vite origins `http://localhost:5173` and `http://127.0.0.1:5173`.

## Testing instructions

Backend tests refuse to run unless `TEST_DATABASE_URL` names exactly `wattwise_test`. Each session creates a unique temporary schema and removes only that schema when complete.

```powershell
cd backend
$env:TEST_DATABASE_URL = "postgresql+psycopg2://wattwise:<PASSWORD>@127.0.0.1:5432/wattwise_test"
.\.venv\Scripts\python.exe -m pytest -q
```

Compile and build the frontend:

```powershell
cd frontend
npx.cmd tsc -b
npm.cmd run build
```

## Verified test results

The existing Phase 2 verification report records **16 backend tests passed and 0 failed** against PostgreSQL. Coverage includes migration repeatability, database safety, energy and water entry validation, duplicate prevention, leaderboard points, achievements, Asia/Kolkata streaks, CORS, and solar arithmetic.

This README records that established result; users should rerun the commands above in their own configured environment before deployment.

## Security and privacy considerations

- Database credentials are supplied through process environment variables and excluded from Git.
- The repository ignores `.env` files, virtual environments, database dumps, local databases, backups, dependency directories, build output, and TypeScript build caches.
- API validation rejects unknown request fields and invalid decimal formats.
- Database constraints backstop duplicate and range validation.
- Tests are restricted to the `wattwise_test` database and isolated temporary schemas.
- CORS is restricted to the two local Vite development origins.
- The application stores display names and household activity but does not implement authentication or authorization; use non-sensitive demo identities.

## Known limitations

- Local hackathon deployment only; authentication, authorization, and multi-tenant isolation are not implemented.
- Carbon output uses a configurable illustrative factor, not a verified regional grid factor.
- Challenge completions are self-reported and are not independently verified.
- Solar output is an assumption-based estimate, not a site survey, quotation, forecast, or savings guarantee.
- Streak calculations use Asia/Kolkata calendar dates.
- Profile selection is retained in browser local storage; there is no account recovery flow.
- The frontend is a single Vite bundle and currently has no automated browser test suite.

## Scalability and future improvements

Potential post-hackathon work includes authenticated accounts, role-based privacy controls, deployment configuration, configurable regional carbon factors, verified utility integrations, accessible end-to-end browser tests, pagination controls for long histories, API observability, and frontend route-level code splitting. These are future opportunities, not implemented features.

## Demo video

> Demo video link: **to be added before submission**

## Screenshots

> Add final screenshots for My Footprint, Water Tracker, Green Actions, Community Impact, and Solar Explorer before judging.

Suggested repository location: `docs/screenshots/`.

## Team

**Solo development** — product design, frontend, backend, database, testing, and documentation completed by the repository owner for HackCult 2026.
