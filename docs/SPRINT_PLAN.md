# 48-hour solo sprint plan

Status: pre-sprint planning only. H0 means the official coding start after the owner has verified HackCult rules and explicitly authorized implementation. H48 is the earlier of H0 + 48 elapsed hours and the official submission deadline; shorten scope if the permitted window is smaller. No calendar dates, coding rights, or competition permissions are assumed here.

## Before H0: planning gate

Edit only `AGENTS.md` and the six existing planning documents under `docs/`, including `UI_SPEC.md` (seven planning files total). Do not create source code, fixtures, tests, migration scripts, dependency manifests/lockfiles, project scaffolding, deployment configuration, or install dependencies. Fixture specifications are Markdown only until authorized coding begins. Confirm official rules on advance preparation, AI assistance, data licenses, and submissions before starting the coding window. Do not claim that these planning documents establish eligibility.

Resolve contract ambiguities in these documents before implementation. Keep exactly the six core domain tables. Preserve the essential flow: upload → validate/store → analytics → explained alert → scenario → estimated savings.

Freeze the MVP to building creation/selection, strict CSV ingestion, selected-building dashboard, explainable anomalies, GridTwin scenarios, the end-to-end demo, and required tests/checks. Accept only `Asia/Kolkata`. Defer campus rollups, building comparison, diurnal analytics, virtualization, general DST/cross-timezone behavior, advanced polish, and a formal accessibility-compliance claim. Keep keyboard access, readable contrast, labels, and chart data alternatives. No extra styling framework is required.

## Milestones during the authorized window

### H0–H4: runnable foundation

- Establish frontend/backend boundaries and configure the local environment with the agreed stack.
- Create SQLAlchemy models and Alembic migration for all six tables, including checks, indexes, and composite foreign keys.
- Add shared API error handling, decimal/time serialization, and building creation/selection.
- Exit evidence: migrate an empty PostgreSQL database and create/read a building through the API. Record verified dependency/runtime versions during the sprint.

### H4–H10: trustworthy ingestion

- Implement the strict CSV grammar, raw-text offset/decimal validation, provenance, successful-byte deduplication, and terminal upload summaries. Prepare the fixture files and meaningful checks now, inside the coding window, using the [known-answer specification](PROJECT_SPEC.md#known-answer-demo-fixture-specification): 168 warm-up hours plus 168 showcase hours, exact spikes, tariff/scenario answers, and isolated invalid/gap/history variants.
- Commit upload/readings atomically; handle stored conflicts and rejected metadata, including concurrent uniqueness failures.
- Exit evidence: valid import; zero reading changes after invalid rows/overlap; duplicate-byte retry returns the original ID. Confirm same-file duplicates and malformed files fail clearly.

### H10–H15: analytics vertical slice

- Implement bounded hourly queries, local-date totals, coverage, mean and peak semantics.
- Connect building selection, upload feedback, selected-building hourly line chart, daily totals, and gap/empty states. Build display-only null points for missing timestamps; use observed-hour means, per-window provenance, kWh energy labels, and `INR/kWh` for the demo tariff. Use ordinary bounded tables.
- Exit evidence: upload-to-dashboard flow works; a 120 kWh/24-hour fixture gives a 5 kWh mean; incomplete coverage remains visible.

### H15–H19: explainable anomaly slice

- Implement the prior-history median/MAD rule and alert reconciliation; display threshold, sample count, method version, provenance, and evaluation time in alert evidence. Plot readings plus alert markers, without a continuous threshold line. Show no-run, insufficient-history, partial-eligibility, and completed states; run counts come only from the immediate POST.
- Exit evidence: the showcase has exactly two alerts, 168 eligible and zero skipped readings; the warm-up window has zero eligible and 168 skipped. Equal-threshold non-spikes, zero-MAD floor, no future-data leakage, and repeat/backfill behavior match the contract. A stored-alert GET never establishes a clean evaluation.

### H19–H23: scenario slice

- Implement immutable scenario selection and complete-period calculation with saved results.
- Add separate baseline/hypothetical cards or simple bars and explicit estimate labels. Bind cards to returned building/scenario/date/tariff assumptions and clear old results on context changes. Decode incomplete-baseline counts from an array-shaped error detail.
- Exit evidence: the 840/420 kWh example yields 84 kWh and 672 cost-unit savings at 20% and rate 8. Partial baselines fail without saved results.

### H23–H30: rest and recovery buffer

Reserve seven hours for rest and meals. No feature work is required in this block; preserve enough energy for integration and submission. Do not rely on unattended agents to extend coding beyond permitted hours.

### H30–H36: integration and correctness

- Complete the frontend journey, including invalid uploads, missing data, no alerts, and zero matched scenario hours.
- Exercise real PostgreSQL constraints/rollback behavior, Kolkata midnight/offset-equivalent boundaries, unsupported-timezone rejection, display-only gaps, conditional upload-summary fetching, and late-response/context invalidation. General DST tests are deferred with that feature.
- Run backend checks, TypeScript checks, and a frontend production build; fix failures within scope.
- Exit evidence: fresh-database setup and full local walkthrough pass; observed/anomaly/hypothetical labels are consistent.

### H36–H41: demonstration and explanation

- Reuse the clearly labeled warm-up/showcase fixtures prepared at H4–H10; do not leave dataset construction until this block. Rehearse upload → 840 kWh dashboard → two explained alerts → 84 kWh/672 INR hypothetical savings, plus rejected CSV and incomplete-history/baseline states.
- Explain what each rule establishes and its limitations; show a bad upload, a chart, an alert with evidence, and an assumption-driven estimate.
- Measure actual local responsiveness and record limitations without inventing benchmark or accuracy claims.
- Exit evidence: one coherent demo and no external-service dependency.

### H41–H45: freeze scope and rehearse

- Stop adding features. Repair only demonstrated defects, contract drift, and presentation blockers.
- Rehearse from clean database migrations; verify all claimed results and inspect secret/data handling.
- Prepare only submission materials permitted by the official rules, within the coding window.

### H45–H48: final buffer and submission

- Repeat only relevant checks after the last fixes; package and submit before the verified deadline.
- Preserve final revision and evidence. At the official end, stop code, dependency, fixture, and migration changes; only expressly permitted submission actions may continue.

## Scope controls

The six main implementation/integration blocks total 29 hours; the rest reserves seven hours of rest plus demonstration, freeze, and submission time. Defer comparison, campus rollups, diurnal charts, virtualization, general DST, and advanced polish from the outset. If behind, cut additional presets, animations, and optional filters first. Keep building/scenario selection, atomic validation, honest labels, anomaly evidence, complete-baseline checks, meaningful tests, migration reproducibility, and savings arithmetic. Do not substitute fabricated results for an unfinished feature; disclose any missing acceptance criterion.

## Ownership and completion evidence

The solo developer owns integration and submission. Agent responsibilities, when separately authorized, are defined in [../AGENTS.md](../AGENTS.md); parallel agents are not assumed. Save test/build results and demo observations during the coding window. Completion means the acceptance criteria in [PROJECT_SPEC.md](PROJECT_SPEC.md) are demonstrated, with limitations stated and no claim of achieved energy savings.
