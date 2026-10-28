# WattWise AI + GridTwin Lite — Project specification

Status: pre-sprint planning only. Event and track: HackCult 2026, Green Energy & Sustainability (user-provided). Official coding dates and competition rules have not been verified. The 48-hour plan starts at an authorized H0; it is not an event schedule.

## Goal and users

Help a building operator or campus sustainability team understand uploaded hourly electricity consumption, inspect explainable statistical alerts, and compare simple energy-saving assumptions. A solo developer must be able to demonstrate the complete workflow in 48 hours using React, TypeScript, Vite, Recharts, FastAPI, PostgreSQL, SQLAlchemy, Alembic, and Pandas.

The product name includes “AI,” but the MVP uses documented statistical rules and arithmetic. GridTwin Lite is a scenario calculator over historical readings, not a calibrated physical digital twin.

## Meaning of results

- **Observed consumption:** submitted hourly kWh readings, labeled with upload provenance (`observed` or `demo`). Upload validation establishes format and consistency, not meter accuracy.
- **Statistical anomaly:** an unusually high reading relative to a specified historical comparison group. It is not proof of a fault, waste, equipment failure, or causation.
- **Hypothetical savings:** an assumed percentage reduction applied to selected historical hours. These are estimates for that baseline period, not measured savings, forecasts, or guarantees.

Every chart, alert, result card, and demo narrative must preserve these distinctions. Demo readings must remain visibly labeled as demo data. Do not claim real-time optimization, AI accuracy, carbon reductions, or achieved savings.

## User journeys

1. Create/select a building with fixed IANA timezone `Asia/Kolkata`, flat electricity price per kWh, and a three-letter display currency code. These settings are immutable in the MVP; uploaded observed data is not independently verified meter data.
2. Upload one hourly electricity CSV and choose `observed` or `demo` provenance. See accepted row count and covered timestamps, or actionable validation errors with CSV row numbers. Correct a rejected file and retry.
3. Choose a time range and inspect uploaded hourly readings, daily energy totals, total/mean/peak consumption, and missing-hour coverage. Missing hours remain gaps.
4. Run anomaly detection for the range. Inspect readings plus alert markers and each flagged reading's reference median, threshold, historical sample count, and templated explanation. No continuous threshold series is available. Distinguish no run, insufficient history, and completed evaluation; eligible/skipped counts exist only in the immediate POST response.
5. Create an immutable reduction scenario with selected local hours, weekdays, and a reduction percentage. Run it on a complete historical period and compare baseline consumption, hypothetical consumption, estimated saved kWh, and estimated flat-rate cost savings.

## MVP scope

- Multiple buildings in one local demo installation; one whole-building electricity series per building.
- Frozen UI: building creation/selection, CSV ingestion, selected-building overview, anomaly evidence, and GridTwin scenario/results. Building comparison, campus rollups, diurnal charts, virtualization, and advanced polish are deferred. Use the existing stack without adding a styling framework requirement.
- Synchronous, all-or-nothing CSV imports; rejected-upload metadata retained when validation reaches the application.
- CSV: UTF-8 (optional BOM), comma-separated with exactly `timestamp,consumption_kwh` columns in either order. Apply the strict record, whitespace, quoting, timestamp, and raw-text decimal grammar in [API_CONTRACT.md](API_CONTRACT.md#strict-csv-grammar). Each row represents energy over the one-hour interval starting at `timestamp`.
- Explicit timezone offsets required; convert each instant to the building's IANA timezone and require a local whole-hour start. The submitted offset may differ from the building's offset. Store instants in UTC. Reject duplicate instants, overlapping existing readings, negative/non-finite values, and precision overflow. Zero consumption is valid.
- Maximum 5 MiB and 10,000 data rows per upload. Sort valid rows by instant; allow gaps and report them. No interpolation, overwriting, or silent row dropping.
- Analytics, detection, and simulation windows are `[from, to)`, span 1–744 elapsed whole hours, and use Kolkata-local hour boundaries. The sprint MVP accepts only `Asia/Kolkata`; other building timezones return `422 VALIDATION_ERROR`. General DST and cross-timezone comparison are explicitly deferred; the timezone field remains for future scope.
- One upper-spike rule, `hourly_mad_v1`; one scenario model, `targeted_percent_reduction_v1`. Exact algorithms appear in [ARCHITECTURE.md](ARCHITECTURE.md).
- Local demo without authentication, external AI services, paid APIs, or internet dependence at runtime. Database credentials remain outside version control.

## Acceptance criteria

1. A valid CSV creates one successful upload and all its readings. Any invalid row rejects the entire file and inserts no readings. A retry of identical bytes for the same building returns `409` and the original upload ID.
2. Offset-equivalent timestamps identify the same instant. Same-file duplicates and conflicts with stored data are rejected. Missing hours are visible; the analytics response reports observed and expected hours.
3. The specified showcase day totals 120 kWh, returns mean energy `5.0000` kWh per observed one-hour interval, and has full coverage. Daily totals use Kolkata dates. Partial data uses observed hours as the denominator; missing hours become display-only null points. All KPI labels use energy units and the example tariff is `8.0000 INR/kWh`.
4. For a reference median of 5 kWh and MAD of 0.5 kWh, `hourly_mad_v1` yields threshold `7.2239` kWh. A 10 kWh reading is flagged; a reading equal to the threshold is not. Fewer than seven eligible historical rows yields no alert and an insufficient-history count.
5. Repeating detection against unchanged readings produces the same alerts without duplicates. Running after a historical backfill recomputes the selected range and removes alerts that no longer qualify.
6. A complete 168-hour baseline totaling 840 kWh, with 420 kWh in selected hours and a 20% reduction, yields hypothetical consumption of 756 kWh, savings of 84 kWh, and cost savings of 672 currency units at a rate of 8 per kWh. Partial baselines cannot be simulated.
7. The UI completes upload → analytics → explanation → scenario → estimate, with loading, empty, validation-error, no-run, insufficient-history, completed-evaluation, and incomplete-coverage states. Saved results show their building/scenario IDs, baseline period, immutable scenario assumptions, tariff/currency snapshot, provenance, and model version. Clear them when building/scenario/range changes; do not associate old results with new controls.
8. Required backend/integration checks and a frontend production build pass during the authorized coding window. The demo runs from a fresh database after migrations, using a clearly labeled synthetic fixture.

## Known-answer demo fixture specification

This section specifies future fixture files; none may be generated in the planning phase. Implement these fixtures during authorized H4–H10 work, before analytics/detector milestones. API examples use this specification; IDs and creation/evaluation times are illustrative, not fixture assertions. Run variants in isolated buildings or fresh databases to avoid immutable-reading conflicts.

### Main dataset and periods

- Building: `Campus Block A`, timezone `Asia/Kolkata`, rate `8.0000 INR/kWh`; every upload is `source_kind=demo`.
- Full CSV: 336 consecutive hourly interval starts in `[2026-01-01T00:00:00+05:30, 2026-01-15T00:00:00+05:30)`. First stored instant: `2025-12-31T18:30:00Z`; last interval start: `2026-01-14T17:30:00Z`. The exclusive coverage end is one hour after the last start, not `last_recorded_at` itself.
- Warm-up: 168 hours in `[2026-01-01, 2026-01-08)` at local midnight boundaries. Showcase: 168 hours in `[2026-01-08, 2026-01-15)`, equivalent to `[2026-01-07T18:30:00Z, 2026-01-14T18:30:00Z)`.
- Daily base energy: local hours `0–6`, `17`, and `23` each use `5.0000` kWh; `7–16` each use `5.5000`; `18–22` each use `4.0000`. This totals `120.0000` kWh/day, including `60.0000` kWh/day in hours `0–6` and `18–23`.
- On warm-up dates January 1–7, add respectively `-0.5000, -0.5000, -0.5000, 0.0000, +0.5000, +0.5000, +0.5000` kWh to every hour's base. Warm-up daily totals are `108, 108, 108, 120, 132, 132, 132` kWh.
- Showcase dates use the base pattern, with exactly four overrides: January 8 at `02:00` → `10.0000`, January 8 at `03:00` → `0.0000`, January 9 at `05:00` → `10.0000`, January 9 at `06:00` → `0.0000` kWh. These paired changes preserve each day's total and selected-hour sum. They are synthetic examples, not equipment or occupancy claims.

### Expected answers

- Upload: 336 accepted rows, zero missing hours over the full 336-hour interval, all provenance `demo`. Full-period total is `1680.0000` kWh. The default dashboard and simulation range is the showcase only.
- Showcase analytics: `observed_hours=168`, `expected_hours=168`, `missing_hours=0`, `coverage_fraction=1.0`, total `840.0000`, mean `5.0000`, and seven daily totals of `120.0000` kWh. Peak is `10.0000` at January 8 `02:00+05:30` (`2026-01-07T20:30:00Z`); use the earliest timestamp to break the tie.
- Showcase detection: `evaluated_readings=168`, `eligible_readings=168`, `skipped_insufficient_history=0`, `alert_count=2`, and exactly two returned alert objects. January 8 `02:00` has 7 reference samples; January 9 `05:00` has 8. Both have observed `10.0000`, median `5.0000`, MAD `0.5000`, and threshold `7.2239` kWh. No other showcase reading is flagged.
- Scenario: `20.00` percent; hours `[0,1,2,3,4,5,6,18,19,20,21,22,23]`; all weekdays `[0,1,2,3,4,5,6]` (Monday = 0). Label the preset “After-hours 18:00–07:00, end exclusive” (13 hours), without implying actual occupancy.
- Showcase simulation: targeted baseline `420.0000`, estimated savings `84.0000`, hypothetical consumption `756.0000` kWh, and estimated cost savings `672.0000 INR` at the saved `8.0000 INR/kWh` rate. Source-hour count is 168 and provenance is `demo`.

### Required edge variants for the coding window

- **Insufficient history:** detect the main warm-up window January 1–8. Expect 168 evaluated, zero eligible, 168 skipped, zero alerts. The same main dataset's January 14–15 window gives 24 eligible, zero skipped, zero alerts: a completed evaluation, not the same state as insufficient history. Before any POST, even an empty alert GET proves neither state.
- **Missing baseline hour:** on an isolated copy, omit January 10 `12:00+05:30` (`5.5000` kWh). The file has 335 rows. Showcase analytics has 167/168 hours, one missing hour, coverage `167/168` (99.4% displayed), total `834.5000`, and mean `4.9970` kWh per observed interval. Render a null gap. Simulation returns `422 INCOMPLETE_BASELINE`, with counts in a one-element `error.details` array and no saved result, even though all targeted hours remain present.
- **Empty/zero cases:** a no-readings window returns null total/mean/peak and `source_kind=none`; detection returns zero evaluated/eligible/skipped. A complete 24-hour all-zero dataset produces a valid zero-energy/zero-savings result. On the main January 8–9 day, a Monday-only scenario has no matched hours and returns savings `0.0000`, hypothetical `120.0000`, and cost savings `0.0000`.
- **Detector boundaries:** use isolated seven-sample references `[4.5000,4.5000,4.5000,5.0000,5.5000,5.5000,5.5000]` at the same local hour on preceding dates. Candidate `7.2239` is not flagged; `7.2240` is. Seven references of `5.0000` give threshold `5.5000`; equality is not flagged. Repeating a run creates no duplicate alerts. Historical backfill must reconcile changed evidence and remove alerts that cease to qualify.
- **Invalid CSVs:** specify separate files with a wrong/duplicate header, blank record, padded/empty cell, extra/missing field, malformed quoting/UTF-8, negative/non-finite/exponent value, or five fractional digits. Each returns `422 CSV_VALIDATION_FAILED`, zero accepted readings, and a rejected-upload ID when parsing reaches persistence. At least one otherwise valid row must precede an invalid row to establish all-or-nothing behavior.
- **Timestamp/conflict cases:** reject a missing offset, a non-hour Kolkata instant, and same-file offset-equivalent duplicates with `422`; identical successful bytes return `409 DUPLICATE_UPLOAD`; a different valid file overlapping stored instants returns `409 READING_CONFLICT`. File/row-limit cases cover empty input, 10,001 data rows, and over 5 MiB; oversize bytes return `413` without an upload record.
- **Provenance check:** in an isolated variant, import warm-up as `observed` and showcase as `demo`. Showcase analytics and simulation are `demo`; spike alerts are `mixed` because references include observed uploads. A full-period aggregate is `mixed`. This checks labeling without claiming meter verification.

## Limitations and exclusions

No forecasting, machine learning training, LLM explanations, occupancy inference, equipment disaggregation, weather normalization, live meters, control systems, physical building modeling, time-of-use tariffs, demand charges, taxes, emissions calculations, authentication, production deployment, or independently verified savings. Campus rollups/comparison, diurnal analytics, virtualization, advanced polish, general DST, and cross-timezone support are deferred. The flat-price estimate excludes fixed charges and cannot establish bill savings. Several scenario results cannot be added together; scenarios are independent and may overlap.

The detector needs up to 28 days of preceding history and may miss gradual changes or flag legitimate demand. Importing a mixture of demo and observed readings is permitted, but all aggregate results over that range must be labeled `mixed`. No historical period is extrapolated into annual savings.
