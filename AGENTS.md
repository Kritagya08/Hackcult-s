# Shared engineering rules — WattWise AI + GridTwin Lite

## Current authorization and coding window

**Current phase: PRE-SPRINT PLANNING ONLY.** Edit only this existing file and the six existing planning documents: `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`, `docs/API_CONTRACT.md`, `docs/SPRINT_PLAN.md`, and `docs/UI_SPEC.md`. These are seven planning files in total. Do not create application source, tests, migrations, fixtures, dependency manifests/lockfiles, scaffolding, or deployment files. Fixture specifications belong in Markdown only. Do not install project dependencies or implement competition functionality. Stop after the requested documentation is complete.

No official coding dates or HackCult eligibility rules are supplied. Before implementation, the owner must verify the official rules, record the permitted start/end with timezone, and explicitly authorize the coding phase. Do not infer permission from the planned sprint or from these future engineering rules. Outside that verified window, do not change competition code, dependencies, migrations, or fixtures. After the deadline, perform only actions expressly permitted by official rules and the owner.

## Source of truth

- [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md): scope, user-visible behavior, acceptance criteria, and exclusions.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): service boundaries, data flow, precision/time semantics, detector and scenario algorithms.
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md): exactly six domain tables, constraints, relationships, and indexes.
- [docs/API_CONTRACT.md](docs/API_CONTRACT.md): wire contracts, errors, and mutation behavior.
- [docs/SPRINT_PLAN.md](docs/SPRINT_PLAN.md): relative milestones and completion gates.
- [docs/UI_SPEC.md](docs/UI_SPEC.md): minimal screens, API dependencies, state transitions, and display rules.

Resolve contradictions before implementing affected behavior. Update the relevant contracts together when an authorized scope change is made. Do not silently add tables, APIs, dependencies, models, or external services.

The frozen MVP is building creation/selection, atomic CSV ingestion, a selected-building dashboard, explainable anomalies, GridTwin scenarios, an end-to-end demo, and required verification during the coding window. Campus rollups, building comparison, diurnal analytics, virtualization, general DST/cross-timezone support, and advanced polish are deferred. The known-answer fixture specification in `docs/PROJECT_SPEC.md` is the numerical source of truth; do not generate its files before the coding window.

## Ownership and coordination

The human solo developer is the product/rules owner and final submission authority. A lead agent, if authorized, owns scope tracking, cross-document consistency, integration, and verification. Do not spawn or delegate to additional agents without an explicit owner request or applicable higher-priority instruction.

If delegation is later authorized, use these logical ownership boundaries: ingestion/data agent owns validation and persistence; analytics agent owns summaries and detection; simulation agent owns scenario arithmetic/results; frontend agent owns forms, charts, labels, and UI states. These are roles, not a requirement to run four agents. The lead assigns non-overlapping file ownership before work, serializes shared-schema/API changes, and reviews integration. No agent may change another role's files without coordination. The solo developer can fulfill every role.

## Engineering rules for the authorized coding phase

- Use the agreed stack: React + TypeScript + Vite + Recharts; FastAPI + Pandas; PostgreSQL + SQLAlchemy + Alembic. Follow the modular monolith design and keep business logic out of routes/components.
- Keep the six domain tables: `buildings`, `data_uploads`, `energy_readings`, `anomaly_alerts`, `simulation_scenarios`, `simulation_results`. Alembic revision metadata is infrastructure.
- Treat uploaded kWh, statistical alerts, and hypothetical savings as distinct. Label demo/mixed provenance throughout. Do not add unverified AI, causal, carbon, forecast, or achieved-savings claims.
- The sprint MVP accepts only building timezone `Asia/Kolkata`; other timezones return `422 VALIDATION_ERROR`. Use UTC instants for storage, Kolkata time for grouping/selection, explicit input offsets, and half-open ranges. Missing hours become display-only null chart points, never stored/imputed readings. Label energy in kWh per interval, not kWh/hr or peak demand.
- Preserve four-decimal numeric contracts and server-authoritative calculations. Reject invalid input rather than silently rounding it into validity. Use typed request/response models and normalize framework errors to the shared envelope.
- Imports are atomic, immutable, and deduplicated. Database constraints backstop service checks. Never overwrite readings, suppress validation failures, or create partial successful imports.
- Keep detector/model versions explicit; require complete baselines for simulations. A frontend display must not present simulated savings as measured performance.
- Anomaly charts use readings plus alert markers; thresholds appear only in alert evidence. Eligible/skipped counts come only from the immediate detection POST response for the active building/range, never from stored alerts. Zero stored alerts does not establish a completed clean evaluation.
- Bind simulation cards to the saved result's building/scenario/period/rate/currency and immutable scenario definition. Clear results and run summaries on relevant context changes; ignore late responses for old context. Error `details` is always an array; fetch a rejected upload summary only when the error provides `upload_id`.
- Keep credentials outside version control; do not log uploaded file contents or secrets. Enforce server-side file/range bounds. Keep the demo local unless production scope is separately authorized.
- Inspect existing work before edits. Prefer small reviewable changes; do not revert unrelated changes or perform destructive database/Git actions without authorization. Do not hide failing checks or claim checks were run when they were not.

## Required verification during the coding phase

No tests or test code are created/run as application verification in this planning-only phase. Once implementation is authorized, verify behavior with meaningful fixtures and real PostgreSQL integration checks:

- Ingestion: the strict CSV grammar in `docs/API_CONTRACT.md`, raw-text decimal validation, valid and unordered input, UTF-8/BOM/header errors, blank/whitespace/ragged records, size/row limits, numeric precision/zero/negative/non-finite values, invalid offsets, intra-file duplicates, stored overlaps, identical-byte retries, concurrent conflicts, and zero partial reading writes.
- Data integrity/time: cross-building composite foreign keys, uniqueness/status checks, UTC-equivalent instants, Kolkata midnight boundaries, unsupported-timezone rejection, display-only gaps, empty ranges, observed-hour means/coverage, and consistent decimal serialization. General DST support is deferred.
- Detection: exact reference/threshold examples, zero MAD, equal threshold, insufficient history, exclusion of future/candidate data, repeat-run deduplication, and backfill reconciliation.
- Simulation: known arithmetic, hour/weekday selection, four-decimal aggregate rounding, immutable rate/provenance snapshots, incomplete baseline rejection, zero energy, zero matched hours, and independent non-additive scenarios.
- Integration/UI: migrate a fresh database, complete the full workflow with the specified warm-up/showcase data, inspect no-run/insufficient-history/completed states, array-shaped errors, result-context invalidation, loading/error/empty states and honest provenance labels, run backend tests and frontend typecheck/production build, and record what actually passed. Do not claim application tests ran during documentation reconciliation.

Do not replace PostgreSQL with SQLite for constraint verification. Do not pursue arbitrary coverage percentages or build tests that merely repeat implementation details. Report material unverified behavior and failing checks plainly; fix required failures before claiming acceptance.
