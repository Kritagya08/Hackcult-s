# WattWise AI + GridTwin Lite — UI specification

Status: pre-sprint documentation only. No UI source, dependencies, tests, or fixture files are created by this specification.

## Scope and authority

The frozen MVP is building creation/selection → CSV ingestion → selected-building overview → explainable anomalies → GridTwin scenario → saved estimate, plus the end-to-end demo and required coding-window verification. Use React + TypeScript + Vite + Recharts and ordinary CSS; no additional styling framework is required.

[PROJECT_SPEC.md](PROJECT_SPEC.md) owns scope and the [known-answer dataset specification](PROJECT_SPEC.md#known-answer-demo-fixture-specification). [API_CONTRACT.md](API_CONTRACT.md) owns endpoint/payload/error shapes; [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) owns the six tables; [ARCHITECTURE.md](ARCHITECTURE.md) owns algorithms/time semantics; [SPRINT_PLAN.md](SPRINT_PLAN.md) owns the delivery gates. Reuse those contracts instead of defining alternative payloads here.

Campus rollups, building comparison, diurnal profiles, virtualization, general DST/cross-timezone support, advanced animation/polish, and formal accessibility certification are deferred. There is no separate Building Explorer screen, invented campus endpoint, continuous threshold series, equipment model, or editable operating schedule.

## Shared shell and building context

Use a building selector and a basic “Add building” panel, followed by four simple views/tabs: Selected-building overview, Data Studio, Anomalies, and GridTwin Lite. A separate directory/profile analytics screen is unnecessary.

- Populate the selector through `GET /api/v1/buildings?limit=50&offset=0`; use its existing pagination if additional buildings exist. Create through `POST /api/v1/buildings`; fetch an individual profile through `GET /api/v1/buildings/{building_id}` when needed.
- Building creation accepts name (trimmed length 1–120), finite nonnegative flat rate with at most four decimal places, and a three-letter uppercase ASCII display currency code. Do not label the currency field as ISO-membership-validated.
- Timezone is a read-only `Asia/Kolkata` field submitted with the request. Other building timezones return `422 VALIDATION_ERROR`. General DST, timezone selection, and cross-timezone comparison are deferred.
- Show the immutable flat tariff as rate/currency per kWh, e.g. `8.0000 INR/kWh`. A scenario cannot override it.
- The global range picker uses Kolkata-local whole hours and `[from,to)`: inclusive start, exclusive end, 1–744 elapsed whole hours. Serialize explicit offsets or equivalent UTC instants; URL-encode query `+` as `%2B`. The demo range is January 8–15, 2026, at local midnight boundaries.
- Use server-returned provenance: `observed` = uploaded observed readings, not independently verified metering; `demo` = synthetic data; `mixed` = contributing uploads include both; `none` = no readings. Labels remain visible and do not depend on color alone. Alert provenance can differ from the chart because it includes reference samples.
- JSON decimal quantities remain strings in state/contracts; convert only for display/chart coordinates. Do not calculate authoritative thresholds, consumption totals, or savings in React.

### Context changes and late responses

Key reads by building/from/to and detection summaries by building/from/to/method. A building/range change clears displayed analytics and the transient detection summary before refetching. Reload also clears the summary; do not restore evaluation counts from local/session storage or infer them from stored alerts.

Clear the current simulation result when the building, selected scenario, active scenario definition, or baseline range changes; also clear it when a new run starts. A successful upload for the building invalidates its reads, detection summary, and visible current result. Server-saved snapshots remain immutable.

Bind each response to its original request context; ignore late responses for an older context. Never show one building's result or run counts beneath another building's controls. A retrieved historical result is explicitly labeled a saved snapshot and shows its own assumptions.

## Selected-building overview

### Inputs and layout

Fetch the selected building's `GET /api/v1/buildings/{building_id}/analytics?from={from}&to={to}` and `GET /api/v1/buildings/{building_id}/readings?from={from}&to={to}`. There is no building comparison request or campus total.

Show the building name, Kolkata range, provenance, flat tariff, and four cards:

- Total uploaded consumption: `total_kwh`, in kWh.
- Mean energy per observed one-hour interval: `mean_hourly_kwh`, in kWh; never label it kWh/hr.
- Peak hourly energy: `peak.consumption_kwh`, in kWh, with its local timestamp; do not call it peak demand.
- Coverage: `observed_hours / expected_hours`, `missing_hours`, and `coverage_fraction × 100` for display.

Add one hourly consumption line chart and daily totals from `daily` in a simple table or bar chart. No diurnal chart is required. Coverage and provenance apply to the selected window, not the whole campus. A partial-window mean uses observed hours; for example, 1120.5000 kWh over 159 observed hours is 7.0472 kWh per interval at 159/168 coverage (94.6%), not 6.6696. This arithmetic illustration is not a second-building fixture.

### Honest missing-data rendering

Build a display-only grid of UTC instants from `from` to `to`, stepping one elapsed hour. Join returned readings by instant and place null at missing instants; retain actual zero readings as zero. Plot `consumption_kwh`, with null connections disabled. Omitted API records alone do not create chart gaps.

These placeholders are presentation only: never submit or persist them, replace them with zero, interpolate them, or include them in analytics/simulation arithmetic. Display axis/tooltip timestamps in Kolkata while preserving UTC keys. Daily empty values remain null; do not draw zero-height consumption for absent data.

### Known-answer display and states

For the canonical showcase: total 840.0000 kWh, mean 5.0000 kWh per observed interval, 168/168 hours, 100% coverage, seven daily totals of 120.0000 kWh, and earliest peak 10.0000 kWh on January 8 at 02:00 +05:30. Provenance is demo; tariff is 8.0000 INR/kWh.

Loading uses a simple status/spinner. Null total means no readings, with expected/missing hours still shown; real zero totals are valid data. Partial coverage shows a warning and gaps. API failures show the normalized error with a retry action, without retaining metrics from a different context.

## Data Studio: CSV ingestion and validation

### Form and grammar

Provide a native CSV file input, required provenance choice (`observed` or `demo`), concise format hints, and an Upload button. Drag-and-drop and animated progress are optional polish, not MVP requirements. Use `POST /api/v1/buildings/{building_id}/uploads` with multipart `file` and `source_kind`.

Reference the [strict CSV grammar](API_CONTRACT.md#strict-csv-grammar): UTF-8/optional initial BOM, exact two headers, comma/double-quote parsing, no padded/empty/blank/ragged records, explicit-offset timestamps mapping to Kolkata whole hours, and plain nonnegative decimal energy validated from raw text. At most 5 MiB and 10,000 data rows. The server enforces every rule; frontend hints do not replace validation.

A synchronous request displays a generic “Uploading and validating…” status. It does not claim streaming row counts or live backend processing stages.

### Response handling

1. On `201`, use the returned upload summary directly.
2. On error, display `error.code`, `message`, and array-shaped `details` immediately. If and only if `error.upload_id` exists, fetch `GET /api/v1/uploads/{upload_id}` to obtain the terminal rejected summary. Do not fetch a summary for absent IDs.
3. A duplicate upload displays `existing_upload_id` and explains that nothing was reimported; it does not automatically trigger a summary fetch. A conflict shows the returned capped timestamp-detail objects, without treating their count as a total.
4. If a summary lookup fails, retain the original error and label metadata unavailable. Early errors such as 413/415 may have no persisted upload; do not invent an upload ID/status/count.
5. Ignore late summary/upload responses belonging to an old building or request context.

The summary shows status, upload ID, provenance, total rows (or unknown/null), accepted rows, and first/last interval starts. On rejection, accepted rows are zero; “rows not imported” is distinct from individually invalid records and the discovered error count. Render at most 20 structured error details with record number, field, code, and corrective message.

For the canonical full file, display 336 accepted rows, first start January 1 00:00 +05:30, last start January 14 23:00 +05:30 (`2026-01-14T17:30:00Z`), and exclusive extent end January 15 00:00 +05:30. Bounds alone do not prove completeness; use coverage analytics. A contiguous 168-row file starting January 1 00:00 would have last start January 7 23:00 (`2026-01-07T17:30:00Z`), not January 8 00:00.

For oversize files, say “Split into smaller CSV files with non-overlapping timestamps.” Compressed CSV ingestion is unsupported. Focus rejection feedback after submission. File-level errors need not have a row number.

## Anomaly Investigator: readings plus alert markers

### Dependencies and evidence

- `GET /api/v1/buildings/{building_id}/readings?from={from}&to={to}`: consumption line and display-only null gaps.
- `GET /api/v1/buildings/{building_id}/analytics?from={from}&to={to}`: observed/expected/missing coverage for the range.
- `GET /api/v1/buildings/{building_id}/alerts?from={from}&to={to}`: previously stored evidence, without evaluation counts or a completed-run claim.
- `POST /api/v1/buildings/{building_id}/anomaly-runs` with `from` and `to`: immediate reconciliation counts and current alert objects.

Draw the `consumption_kwh` line from readings and markers for alert timestamps, joined by UTC instant. Alert `observed_kwh` is evidence for a flagged point, not a replacement series for all readings. There is **no continuous threshold/median line**: the API has no thresholds for non-alert readings, and the client must not synthesize them.

Use a plain alert table with expandable inline evidence: reading ID, local/UTC timestamp, observed kWh, baseline median kWh, MAD kWh, threshold kWh, reference sample count, method version, explanation, provenance, and per-alert evaluation time. No severity classifier or evidence drawer is required. Explain the prior-28-day same-hour comparison and seven-reference minimum, without inferring a cause or equipment fault.

### Evaluation state rules

- **No run for this context in this session:** before a successful POST, including after reload/range changes. Stored alerts may be shown with their own evaluation times. An empty GET means “No stored alerts; run detection,” not an all-clear. Hide whole-window evaluated/eligible/skipped counts and last-run time.
- **Running:** clear the old run summary and show a spinner. A failed POST does not establish a completed evaluation.
- **No readings:** immediate POST `evaluated_readings=0`; say “No readings to evaluate.” Do not label this insufficient historical sampling or a clean evaluation of expected hours.
- **Insufficient history:** immediate POST has positive evaluated rows, zero eligible rows, and positive skipped rows. Say “No eligible readings; N skipped for insufficient history.”
- **Partial eligibility:** positive eligible and skipped counts. Show “A alerts among E eligible readings; S skipped for insufficient history,” with missing-hour coverage separately. Zero alerts does not certify skipped/missing intervals.
- **Completed evaluation:** positive eligible count with zero skipped. Show the immediate POST counts/time and “A alerts among E eligible readings.” If A is zero, say “No above-threshold readings among E eligible observations”; report missing hours separately. Do not claim unobserved intervals were evaluated.

Only the immediate successful POST supplies the displayed run counts/time; do not reconstruct them from GET results, cached alert totals, or the maximum per-alert timestamp. Clear them on context changes or successful imports, as specified above.

For the canonical showcase, the POST returns 168 evaluated, 168 eligible, zero skipped, and exactly two alerts (both objects appear in the [API example](API_CONTRACT.md#run-and-inspect-detection)):

- January 8 02:00 +05:30 (`2026-01-07T20:30:00Z`): observed 10.0000, median 5.0000, MAD 0.5000, threshold 7.2239 kWh, seven references.
- January 9 05:00 +05:30 (`2026-01-08T23:30:00Z`): the same energy evidence, eight references.

The warm-up window instead yields zero eligible/168 skipped; January 14–15 yields 24 eligible/zero skipped/zero alerts. These are distinct UI states.

## GridTwin Lite: immutable scenario and saved estimate

### Form and existing API calls

List `GET /api/v1/buildings/{building_id}/scenarios?limit=50&offset=0`, create with `POST /api/v1/buildings/{building_id}/scenarios`, and fetch `GET /api/v1/scenarios/{scenario_id}` when the immutable definition is not already loaded.

The scenario form has a trimmed 1–120 character name, decimal-string reduction percentage `0.01–50.00` in 0.01 steps, unique nonempty local-hour selections `0–23`, and unique nonempty weekdays `0–6` (Monday = 0). The baseline range uses the shared picker. Show the building rate read-only; do not submit a tariff override.

Keep an All hours preset and the clearly labeled “After-hours 18:00–07:00, end exclusive” preset, selecting `[0,1,2,3,4,5,6,18,19,20,21,22,23]` (13 hours). This is a user assumption, not an occupancy or operating schedule. Additional presets are optional/deferred.

Save before running: only a selected immutable scenario for the current building can be executed. An unsaved form must not be presented as the active saved definition; save/select the intended definition first. Run `POST /api/v1/scenarios/{scenario_id}/runs` with only `from` and `to`. Existing `GET /api/v1/simulation-results/{result_id}` retrieves a saved snapshot; no result-history list or new endpoint is required.

### Result binding

The result card displays the returned building/scenario IDs and names from those linked immutable records, baseline start/end (explicit end exclusive, Kolkata timezone), source-hour count, provenance, model version, calculation time, and its saved `rate_per_kwh`/`currency`. Display the linked saved scenario's percentage, hours, and weekdays; never substitute unsaved form inputs or another building's tariff.

Show server values for baseline, targeted baseline, hypothetical consumption, estimated saved kWh, and estimated energy-only cost savings. Use separate labels and simple bars/cards; no hypothetical hourly curve or client savings calculation. Explain that these are historical-period assumptions, not measured savings, forecasts, or additive scenario totals.

Clear the visible current result on the context changes/new run/import described above; ignore late responses for old context. Loading/errors cannot leave an old result apparently associated with a new scenario. A deliberately retrieved historical result is labeled “Saved snapshot” and uses its own assumptions.

### Baseline and error states

A complete period of 1–744 hours is allowed; seven days is the demo choice, not a simulation minimum. Any missing expected hour, including a non-targeted hour, causes `422 INCOMPLETE_BASELINE` and no saved result. Display the counts from the first object in `error.details`, using the normalized array form:

```json
{
  "error": {
    "code": "INCOMPLETE_BASELINE",
    "message": "Cannot simulate: baseline has missing readings.",
    "details": [
      { "observed_hours": 167, "expected_hours": 168, "missing_hours": 1 }
    ]
  }
}
```

A complete zero-energy baseline or one with no selected matching hours is a valid zero-savings result, not an error or empty state. Backend validation remains authoritative even when the UI already shows coverage.

The canonical showcase result uses the saved 20.00%/13-hour/all-weekdays scenario and January 8–15 range: baseline 840.0000, targeted 420.0000, hypothetical 756.0000, savings 84.0000 kWh, and cost savings 672.0000 INR at the saved 8.0000 INR/kWh rate, with 168 source hours and demo provenance.

## Shared errors, layout, and accessibility targets

Use the API's `error.code`, `message`, and array-shaped `details` consistently, including baseline counts and timestamp conflicts. All detail entries are objects; the array may be empty. Do not assume every error has a row or upload ID. Keep distinct no-building, no-reading, no-run, insufficient-history, no-scenario, loading, and failed-request states.

Retain the dark navy/cyan direction with a small CSS token set: root `#0a0f1d`, surface `#0f172a`, border `#334155`, cyan `#06b6d4`, primary text `#f8fafc`, secondary text `#94a3b8`. Use dark navy text on filled cyan buttons and verify actual rendered contrast during the sprint. Provenance can use emerald/purple/amber/slate with text labels; anomalies use a clearly labeled red marker. No unverified contrast ratios or full WCAG-compliance claim are made.

Use four metric columns on wide screens, two on medium widths, and one on narrow screens. Let navigation wrap, stack forms/results, and horizontally scroll ordinary bounded tables. No table virtualization, mobile drawer, custom tooltip gestures, or animation system is required.

Required accessibility targets for coding-window verification: native labeled inputs/buttons, visible keyboard focus, logical traversal, keyboard-operable selections, readable contrast, text explanations for color-coded states, a data-table alternative to charts, and clear status/error announcements. Prefer inline evidence/building forms over complex modals. Formal WCAG auditing/certification and advanced responsive polish are deferred.

## Minimal demo and future verification

Follow the [fixture specification](PROJECT_SPEC.md#known-answer-demo-fixture-specification) without creating files before the coding window. Demonstrate a valid full import, the selected-building showcase, two explained spikes, the saved 84 kWh/672 INR estimate, and isolated invalid-CSV, insufficient-history, missing-baseline, and zero-result states.

During authorized implementation, verify the full journey, exact fixture answers, no-run versus completed states, display-only gaps/real zeros, upload-summary fetching only with an ID, scenario/result binding, and late-response invalidation. Run the required backend checks and frontend typecheck/production build then. This document makes no claim that application code or tests currently exist or have run.
