# Database schema

Status: planned PostgreSQL schema, expressed as documentation only. Exactly six application tables are in scope. Alembic's own revision metadata is migration infrastructure, not a seventh domain table. SQLAlchemy models and migrations will be created only during the authorized coding window.

## Conventions

Use UUID application-generated IDs except for identity-generated `energy_readings.id` (`BIGINT`). All fields are `NOT NULL` unless marked nullable. Timestamps are `TIMESTAMPTZ`, stored/compared as UTC; `created_at`/`evaluated_at`/`calculated_at` default to database `now()`. Strings used as enums have database `CHECK` constraints, avoiding extra lookup tables. Energy is `NUMERIC(14,4)` per reading and `NUMERIC(18,4)` for aggregates; prices are `NUMERIC(12,4)` and cost estimates are `NUMERIC(28,4)` to accommodate their product. Reject non-finite numeric input before persistence and in numeric database checks. No public delete/update endpoints or cascades are planned; only alert reconciliation updates/deletes domain rows. Foreign keys use `ON DELETE RESTRICT`.

## 1. `buildings`

- `id UUID PRIMARY KEY`.
- `name VARCHAR(120)`; trimmed length 1–120.
- `timezone VARCHAR(64)`; IANA identifier; the sprint service accepts only `Asia/Kolkata` and rejects other values with `422 VALIDATION_ERROR`. General DST/cross-timezone support is deferred; no field/type change is required.
- `electricity_rate_per_kwh NUMERIC(12,4)`; finite and `>= 0`.
- `currency CHAR(3)`; check three uppercase ASCII letters; display code only, without ISO membership validation or conversion. The known-answer demo uses `INR`.
- `created_at TIMESTAMPTZ`.

Building timezone, currency, and price are immutable in the MVP. Index `(created_at DESC, id DESC)` for the building list. Names need not be unique.

## 2. `data_uploads`

- `id UUID PRIMARY KEY`.
- `building_id UUID REFERENCES buildings(id)`.
- `original_filename VARCHAR(255)`; sanitized display name, never a server filesystem path.
- `sha256 CHAR(64)`; lowercase hexadecimal digest of original uploaded bytes.
- `source_kind VARCHAR(16)`; check `IN ('observed', 'demo')`.
- `status VARCHAR(16)`; check `IN ('succeeded', 'rejected')`.
- `total_rows INTEGER NULL`; data-row count, excluding header; null if parsing cannot establish it, otherwise `>= 0`.
- `accepted_rows INTEGER`; `>= 0`.
- `error_summary JSONB NULL`; rejection code, message, discovered error count, and `details`, always an array of up to 20 error objects, consistent with the API error envelope.
- `created_at TIMESTAMPTZ`.

Checks: a successful upload has `total_rows IS NOT NULL`, `total_rows BETWEEN 1 AND 10000`, `accepted_rows = total_rows`, and no error summary; a rejected upload has `accepted_rows = 0` and a non-null error summary. Neither state exposes partial reading imports.

Keys/indexes: `UNIQUE (id, building_id)` supports the reading's composite foreign key. Partial unique index `(building_id, sha256) WHERE status = 'succeeded'` deduplicates successful files; rejected retries remain possible. Index `(building_id, created_at DESC, id DESC)` supports upload diagnostics and future history views.

## 3. `energy_readings`

- `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`.
- `building_id UUID REFERENCES buildings(id)`.
- `upload_id UUID`.
- `recorded_at TIMESTAMPTZ`; start of a one-hour interval.
- `consumption_kwh NUMERIC(14,4)`; finite and `>= 0`.

Keys: `FOREIGN KEY (upload_id, building_id) REFERENCES data_uploads(id, building_id)` prevents cross-building attribution; `UNIQUE (building_id, recorded_at)` prevents overlapping imports; `UNIQUE (id, building_id)` supports alert ownership. The unique `(building_id, recorded_at)` B-tree serves ordered range queries and historical lookbacks. Add index `(upload_id)` for upload lookups/FK checks.

The service applies the API's strict CSV grammar to raw text, requires explicit offsets, normalizes instants to UTC, and enforces Kolkata-hour alignment, four-decimal precision, and successful parent-upload ownership. A foreign key alone cannot enforce parent status. Gaps are permitted; UI null placeholders are never database rows. All inserts occur inside the successful upload transaction. General DST behavior is outside sprint scope.

## 4. `anomaly_alerts`

- `id UUID PRIMARY KEY`.
- `building_id UUID REFERENCES buildings(id)`.
- `reading_id BIGINT`.
- `method_version VARCHAR(40)`; MVP value `hourly_mad_v1`.
- `observed_kwh NUMERIC(14,4)`, `baseline_kwh NUMERIC(14,4)`, `mad_kwh NUMERIC(14,4)`, `threshold_kwh NUMERIC(18,4)`; finite and nonnegative.
- `sample_count INTEGER`; check `>= 7`.
- `source_kind VARCHAR(16)`; check `IN ('observed', 'demo', 'mixed')`, derived from the candidate and reference readings.
- `explanation TEXT`; deterministic text from persisted evidence.
- `evaluated_at TIMESTAMPTZ`.

Keys: `FOREIGN KEY (reading_id, building_id) REFERENCES energy_readings(id, building_id)`; `UNIQUE (reading_id, method_version)`. Check `threshold_kwh >= baseline_kwh` and `observed_kwh > threshold_kwh`. Index `(building_id, evaluated_at DESC)` supports building diagnostics; alert period queries join through the indexed reading timestamp. The service ensures the observed snapshot equals its reading and that method evidence follows the architecture formula.

Reconciliation updates existing alert evidence and deletes stale alerts only for the requested period and method version. Evaluation history and whole-window eligible/skipped counts are not retained. An empty alert collection does not prove an evaluation occurred or had sufficient history. The UI uses only immediate POST counts; no detection-run table or continuous-threshold series is added.

## 5. `simulation_scenarios`

- `id UUID PRIMARY KEY`.
- `building_id UUID REFERENCES buildings(id)`.
- `name VARCHAR(120)`; trimmed length 1–120.
- `reduction_percent NUMERIC(5,2)`; finite, check `> 0 AND <= 50`.
- `target_hours_local SMALLINT[]`; 1–24 elements, each in `0..23`.
- `target_weekdays_local SMALLINT[]`; 1–7 elements, each in `0..6`, Monday = 0.
- `created_at TIMESTAMPTZ`.

Check arrays are one-dimensional, non-empty, have no null elements, and are subsets of their allowed values. The service rejects duplicate array entries and stores sorted arrays. `UNIQUE (id, building_id)` supports result ownership. Index `(building_id, created_at DESC, id DESC)` supports the scenario list. Scenario definitions are immutable.

## 6. `simulation_results`

- `id UUID PRIMARY KEY`.
- `building_id UUID REFERENCES buildings(id)`.
- `scenario_id UUID`.
- `baseline_from TIMESTAMPTZ`, `baseline_to TIMESTAMPTZ`; check `baseline_to > baseline_from`.
- `baseline_kwh NUMERIC(18,4)`, `targeted_baseline_kwh NUMERIC(18,4)`, `hypothetical_kwh NUMERIC(18,4)`, `estimated_savings_kwh NUMERIC(18,4)`; finite and nonnegative.
- `estimated_cost_savings NUMERIC(28,4)`; finite and nonnegative.
- `source_hour_count INTEGER`; check `> 0`.
- `source_kind VARCHAR(16)`; check `IN ('observed', 'demo', 'mixed')`.
- `rate_per_kwh NUMERIC(12,4)`; finite and `>= 0`, copied from building settings.
- `currency CHAR(3)`; same uppercase check as the building.
- `model_version VARCHAR(40)`; MVP value `targeted_percent_reduction_v1`.
- `calculated_at TIMESTAMPTZ`.

Keys: `FOREIGN KEY (scenario_id, building_id) REFERENCES simulation_scenarios(id, building_id)`. Index `(scenario_id, calculated_at DESC, id DESC)` for saved run lookup; index `(building_id)` for ownership/FK checks.

Checks: `targeted_baseline_kwh <= baseline_kwh`; `hypothetical_kwh + estimated_savings_kwh = baseline_kwh`; `estimated_savings_kwh <= targeted_baseline_kwh`; `estimated_cost_savings = round(estimated_savings_kwh * rate_per_kwh, 4)`. Require integral elapsed hours in `1..744` and `source_hour_count = extract(epoch FROM (baseline_to - baseline_from)) / 3600`. The service verifies every expected instant exists and applies the scenario percentage and provenance derivation. Repeated runs create separate immutable snapshots.

## Relationships and transaction invariants

- Building → uploads, readings, alerts, scenarios, and results: one-to-many.
- Successful upload → readings: one-to-many; rejected upload → zero readings.
- Reading → alerts: zero-to-many across method versions, at most one per version.
- Scenario → results: one-to-many, always within the same building.

Composite foreign keys prevent a valid child ID from being paired with the wrong building. Status ownership, timezone validation, data completeness, provenance, and statistical formulas require service validation in addition to database constraints. Translate uniqueness violations into documented API conflicts; never return an internal SQL error.

The existing result/scenario/building fields are sufficient to label a saved simulation's immutable assumptions. The UI must use result snapshots and the linked scenario rather than current unsaved controls. No table, column, or index has been added for comparison, campus analytics, diurnal charts, or UI state. Known-answer fixture definitions are in [PROJECT_SPEC.md](PROJECT_SPEC.md#known-answer-demo-fixture-specification); fixture files are deferred until the coding window.
