# WattWise LiFE | HC26-GEDA01 | Sprint MVP Contract v1.0

> **Historical Phase 1 contract.** This file records the original four-table,
> 11-endpoint baseline. The implemented Phase 2 system has five domain tables
> and 16 endpoints. Use the root `README.md`, `backend/app/main.py`,
> `backend/app/models.py`, and `docs/MISSION_LIFE_ARCHITECTURE.md` as the current
> implementation references.

Status: archived implementation contract for the October 27–29, 2026 HackCult sprint. It superseded the prior campus WattWise AI feature/API schema when the Mission LiFE citizen-engagement work began. It is retained only as Phase 1 history and is not the current implementation contract.

## Purpose and constraints
Citizen-first, responsive web app for household electricity awareness and Mission LiFE actions. Four screens: (1) My Footprint, (2) Green Actions, (3) Community Impact, (4) Solar Explorer. Dynamic data, no fake analytics or success states. React + TypeScript + Vite + Recharts + plain CSS; FastAPI + SQLAlchemy + Alembic + PostgreSQL 17. Native Windows, Python 3.13. No Docker, external LLM, login, maps, weather API, payment, or marketplace for Phase 1. No third-party premade full app/templates.

## Data model (four domain tables)
- `profiles`: `id UUID PK`, `display_name VARCHAR(80) NOT NULL`, `city VARCHAR(100) NULL`, `created_at TIMESTAMPTZ NOT NULL`.
- `energy_entries`: `id UUID PK`, `profile_id UUID NOT NULL FK profiles`, `period_month DATE NOT NULL` (first of calendar month), `electricity_kwh NUMERIC(12,2) NOT NULL CHECK >=0`, `created_at TIMESTAMPTZ NOT NULL`; UNIQUE (`profile_id`, `period_month`).
- `challenges`: `id UUID PK`, `code VARCHAR(50) UNIQUE NOT NULL`, `title VARCHAR(120) NOT NULL`, `description TEXT NOT NULL`, `points INTEGER NOT NULL CHECK >0`, `active BOOLEAN NOT NULL DEFAULT TRUE`.
- `completions`: `id UUID PK`, `profile_id UUID NOT NULL FK profiles`, `challenge_id UUID NOT NULL FK challenges`, `completed_on DATE NOT NULL`, `created_at TIMESTAMPTZ NOT NULL`; UNIQUE (`profile_id`,`challenge_id`,`completed_on`).

Create 5-7 ordinary Mission LiFE micro-tasks during authorized sprint, e.g. turn off unused lights, use daylight, switch off idle devices. User-reported completion is not independently verified. Points are derived by joins to saved completions; never trust client-supplied points. Optional index on `energy_entries(profile_id, period_month)` and `completions(profile_id, completed_on)`.

## Wire rules
API base `http://127.0.0.1:8000/api/v1`. Browser origin `http://localhost:5173` with correct CORS. All IDs are UUID strings, UTC timestamps ISO8601 with `Z`, decimals are **strings** with exactly 2 digits on responses, dates `YYYY-MM-DD`, months `YYYY-MM-01`. JSON, except no multipart in this MVP. Errors: `{ "error": { "code": "SOME_CODE", "message": "Human-readable", "details": [] } }`; 404 unknown resources, 409 conflicts, 422 invalid inputs, 500 unexpected failures (not leaked stack traces). Pagination `limit` default 50 max 100 and `offset` default 0. No authentication: expressly demo-only, not production-ready. For demo privacy use nicknames, not real names. Server validates ownership by profile relationship where relevant; this is **not** authorization/security.

## Endpoints (11 total)
1. `POST /profiles` request `{ "display_name":"Asha", "city":"Gandhinagar" }`; response `201 Profile`.
2. `GET /profiles/{profile_id}` -> `200 Profile`.
3. `POST /profiles/{profile_id}/energy-entries` request `{ "period_month":"2026-10-01", "electricity_kwh":"220.00" }`; `201 EnergyEntry`, duplicate month `409 ENTRY_EXISTS`.
4. `GET /profiles/{profile_id}/energy-entries?limit=50&offset=0` -> `{ "items": EnergyEntry[], "limit":50, "offset":0, "total":N }`, newest month first.
5. `GET /profiles/{profile_id}/footprint` -> `{ "profile_id":UUID, "emissions_factor_kg_per_kwh":"0.7000", "items":[{ "period_month":"2026-10-01", "electricity_kwh":"220.00", "estimated_kg_co2e":"154.00" }], "latest_change_percent": string|null, "assumption_note": string }` with all months ascending; `latest_change_percent` = (latest_kwh - previous_kwh)/previous_kwh*100, null if fewer than 2 entries or previous=0. Factor **0.7000 is an illustrative configurable demo assumption, NOT a verified regional/grid factor**. Display prominently; no claim of measured CO2 savings.
6. `GET /challenges?limit=50&offset=0` -> paginated active challenges `{ items: Challenge[], limit, offset, total }`.
7. `POST /profiles/{profile_id}/completions` request `{ "challenge_id": UUID, "completed_on":"2026-10-27" }`; `201 Completion`, duplicate same task same date `409 ALREADY_COMPLETED`; no client-specified points.
8. `GET /profiles/{profile_id}/completions?limit=50&offset=0` -> paginated `Completion[]`, include embedded `challenge` metadata and awarded points for display.
9. `GET /leaderboard?limit=20&offset=0` -> `{items:[{"profile_id":UUID,"display_name":"Asha","points":20,"completed_count":2}], limit, offset, total }`, sort points DESC then display_name ASC then profile ID; calculated from persisted completions.
10. `GET /profiles/{profile_id}/nudges` -> `{ items:[{code,title,message,reason}] }`, deterministic personalized messages from latest vs previous consumption; fallback actionable general tips if insufficient data; no AI claims.
11. `POST /solar/estimate` request `{ "roof_area_m2":"30.00", "electricity_tariff_inr_per_kwh":"8.00" }`; response `{ "roof_area_m2":"30.00", "estimated_capacity_kwp":"5.00", "estimated_annual_generation_kwh":"7300.00", "estimated_annual_energy_value_inr":"58400.00", "assumptions": { "area_m2_per_kwp":"6.00", "daily_kwh_per_kwp":"4.00", "days_per_year":365 }, "disclaimer": "Illustrative only. No assessment of roof orientation, shading, weather, grid export, tariffs, costs or subsidies." }`. Formula capacity=area/6; generation=capacity*4*365; value=generation*tariff, Decimal rounded HALF_UP to 2 decimal places. Inputs nonnegative and bounded reasonably; reject nonfinite/malformed/excess precision. Do not claim net savings, ROI or payback.

Types: `Profile = {id,display_name,city,created_at}`; `EnergyEntry = {id,profile_id,period_month,electricity_kwh,created_at}`; `Challenge = {id,code,title,description,points,active}`; `Completion = {id,profile_id,challenge_id,completed_on,created_at,challenge,points}`. Never fabricate additional backend response fields; coordinate any changes before editing either side.

## Frontend flows
**My Footprint:** create/select demo profile, enter monthly kWh, show persisted history and calculated footprint with illustrative factor disclaimer.
**Green Actions:** show server-driven nudges + active challenges, save daily completion, show points and duplicate handling.
**Community Impact:** server-computed leaderboard and own activity; indicate self-reported tasks.
**Solar Explorer:** user-entered roof area/tariff, real server-calculated estimate and assumptions/disclaimer.
Profile ID may be stored in browser localStorage for demo convenience; validate selection on load and make switching possible. Do not call this authentication. Show loading/empty/error states and request guards, mobile responsiveness, accessible labels.

## Test and demo gates
- Fresh DB migration creates four domain tables; repeatable challenge seed without duplicates.
- Create profile; enter two months; verify trend uses stored values and changing inputs changes outputs.
- Footprint math for 220.00 kWh yields 154.00 kg CO2e with clearly displayed illustrative factor.
- Challenge completion increments derived points once; duplicate same date returns 409; persisted leaderboard updates.
- Nudge content responds to recorded consumption.
- Solar 30m2, INR8/kWh yields 5kWp, 7300 kWh/year, illustrative annual energy value INR58400; alternate inputs change outputs.
- Browser E2E across four screens; no hardcoded KPI responses; error cases; clean frontend production build and backend tests.
- Public repo with sprint commits, README, architecture diagram; unlisted YouTube LIVE working app walkthrough; pitch deck. Submit before October 29, 2026 18:30 IST.

## Ownership
Gemini Pro: `frontend/` exclusively. Claude Sonnet (shared Opus/Sonnet/GPT quota): `backend/` exclusively. Root Git/README/contract changes by human approval only. Codex reserved for difficult failures. Old campus planning documents are historical, not implementation authority for this new problem statement.
