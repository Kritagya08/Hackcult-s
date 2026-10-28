# REST API contract

Status: planned API, not implemented. Base path `/api/v1`; JSON unless multipart is stated. No authentication in the local MVP. There are no update/delete endpoints. Schemas and calculations must agree with [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## Shared rules

- IDs are UUID strings, except reading IDs are decimal integer strings to preserve `BIGINT` precision in JavaScript. Timestamps are RFC 3339 with an explicit offset; responses use UTC `Z`. The sprint MVP accepts only building timezone `Asia/Kolkata`; any other timezone returns `422 VALIDATION_ERROR`. General DST and cross-timezone behavior are deferred without changing the timezone field.
- Energy, prices, money, and percentages are JSON decimal strings. Energy/money use four decimal places; scenario percentages use two. Counts and coverage fractions are JSON numbers. Reject extra body fields, non-finite values, and excess precision rather than silently rounding inputs.
- Every window requires `from` and `to`: inclusive/exclusive, explicit offsets, and 1–744 elapsed whole hours. Convert each instant to the building timezone to validate whole-hour boundaries; the submitted offset need not equal the building offset. URL-encode `+` in query strings. Window errors return `422 INVALID_TIME_RANGE`.
- Building/scenario collections use `{ "items": [], "limit": 50, "offset": 0, "total": 0 }`; `limit` defaults to 50, maximum 100, `offset >= 0`, ordered by `(created_at DESC, id DESC)`. Reading/alert collections are bounded by the window and return `{ "items": [] }` without pagination.
- Provenance `source_kind` is `observed`, `demo`, `mixed`, or `none` for empty read aggregates. Alerts combine target/reference provenance. Every saved simulation includes provenance, baseline period, model version, rate, and currency.
- Money is an energy-only flat-rate estimate, excluding taxes and fixed/demand charges. Analytics consumption and simulated consumption have distinct field names.
- This contract remains building-scoped: no campus rollup/comparison, diurnal endpoint, continuous threshold series, or stored detection-run summary is required. [UI_SPEC.md](UI_SPEC.md) narrows presentation to the available fields. [PROJECT_SPEC.md](PROJECT_SPEC.md#known-answer-demo-fixture-specification) defines the canonical demo data; example IDs/times of execution are illustrative.

## Endpoint inventory

- `POST /buildings` → `201` building. Body: `name`, `timezone`, `electricity_rate_per_kwh`, `currency`.
- `GET /buildings?limit=50&offset=0` → `200` paginated buildings.
- `GET /buildings/{building_id}` → `200` building; unknown ID → `404`.
- `POST /buildings/{building_id}/uploads` → `201` upload summary. Multipart fields: `file` and `source_kind` (`observed` or `demo`, required). Processing completes synchronously.
- `GET /uploads/{upload_id}` → `200` terminal upload summary, including rejection details if applicable; unknown ID → `404`.
- `GET /buildings/{building_id}/readings?from=...&to=...` → `200` ordered observed readings, each with `id`, `upload_id`, `recorded_at`, `consumption_kwh`, and contributing upload's `source_kind`.
- `GET /buildings/{building_id}/analytics?from=...&to=...` → `200` computed totals, peak, coverage, provenance, and daily aggregates. Does not run detection.
- `POST /buildings/{building_id}/anomaly-runs` → `200` reconciliation summary and current alerts; body `{ "from": "...", "to": "..." }`.
- `GET /buildings/{building_id}/alerts?from=...&to=...` → `200` alerts joined to reading timestamps in the window, ordered by `(recorded_at, id)`. Returns the MVP method `hourly_mad_v1`; no automatic rerun.
- `POST /buildings/{building_id}/scenarios` → `201` immutable scenario. Body: `name`, `reduction_percent`, `target_hours_local`, `target_weekdays_local`.
- `GET /buildings/{building_id}/scenarios?limit=50&offset=0` → `200` paginated scenarios.
- `GET /scenarios/{scenario_id}` → `200` scenario.
- `POST /scenarios/{scenario_id}/runs` → `201` saved simulation result; body `{ "from": "...", "to": "..." }`. Each successful request creates a new result.
- `GET /simulation-results/{result_id}` → `200` saved result.

All nested building endpoints verify that the building exists; other missing resources return `404 RESOURCE_NOT_FOUND`. An existing building with no matching readings returns an empty `200` read result. Detection on an empty window returns zero counts. Simulation on an empty/partial window returns `422`.

## Create a building

`POST /buildings`

```json
{
  "name": "Campus Block A",
  "timezone": "Asia/Kolkata",
  "electricity_rate_per_kwh": "8.0000",
  "currency": "INR"
}
```

`201` (also the shape of `GET /buildings/{building_id}`):

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Campus Block A",
  "timezone": "Asia/Kolkata",
  "electricity_rate_per_kwh": "8.0000",
  "currency": "INR",
  "created_at": "2026-01-30T10:00:00Z"
}
```

## Upload and inspect a CSV

Multipart `POST /buildings/11111111-1111-4111-8111-111111111111/uploads` with `source_kind=demo`, `file=energy.csv`. The following previews only the first two rows of the specified 336-row warm-up/showcase file; the response below assumes the full file was uploaded. No fixture file is created in this planning phase.

```csv
timestamp,consumption_kwh
2026-01-01T00:00:00+05:30,4.5000
2026-01-01T01:00:00+05:30,4.5000
```

`201`:

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "building_id": "11111111-1111-4111-8111-111111111111",
  "original_filename": "energy.csv",
  "source_kind": "demo",
  "status": "succeeded",
  "total_rows": 336,
  "accepted_rows": 336,
  "first_recorded_at": "2025-12-31T18:30:00Z",
  "last_recorded_at": "2026-01-14T17:30:00Z",
  "error_summary": null,
  "created_at": "2026-01-30T10:01:00Z"
}
```

`GET /uploads/{upload_id}` has the same shape; first/last timestamps are derived from associated readings and are null for rejected uploads. The digest remains internal. CSV limits are 5 MiB, 10,000 data rows, at least one data row, UTF-8 with optional BOM, and exactly the two headers. Allow `.csv` files with `text/csv`, `application/octet-stream`, or absent MIME metadata; otherwise `415 UNSUPPORTED_FILE_TYPE`. Validation reads the content rather than trusting the MIME type.

`last_recorded_at` is the final interval's start, not the exclusive coverage end. For a contiguous file, that end is `last_recorded_at + 1 hour`; first/last bounds alone do not establish completeness when gaps exist. The canonical 336-row file ends exclusively at `2026-01-14T18:30:00Z`. A contiguous 168-row file starting at `2025-12-31T18:30:00Z` would instead have last start `2026-01-07T17:30:00Z`.

Each timestamp must have an explicit offset and map to a whole hour in the building timezone. Equivalent instants such as `2026-01-01T00:00:00+05:30` and `2025-12-31T18:30:00Z` have the same storage key. Consumption must be finite, nonnegative, and fit `NUMERIC(14,4)` without rounding. Unordered rows are sorted; duplicate timestamps within the file fail validation. Identical successful bytes for the same building return `409 DUPLICATE_UPLOAD` with `existing_upload_id`. A different file containing stored timestamps returns `409 READING_CONFLICT`; no existing readings are overwritten.

### Strict CSV grammar

- Encoding is UTF-8, with an optional BOM only at the start. Use comma delimiters and LF or CRLF record endings. One terminal record ending is allowed; an additional empty record is a validation error. Bare CR, comments, compressed content, embedded line breaks inside fields, and malformed quoting are rejected.
- Standard double-quoted fields are allowed; embedded double quotes must be doubled. After CSV decoding, the header must contain exactly the two distinct names `timestamp` and `consumption_kwh`, in either order, with matching case. Every data record must have exactly two fields; reject extra/missing fields rather than inferring an index or dropping content.
- Do not trim or normalize decoded field text. Reject leading/trailing whitespace, blank/whitespace-only records, and empty/whitespace-only cells, including quoted empty cells. Do not silently skip blank lines or interpret tokens as missing values.
- Timestamp text uses RFC 3339 calendar dates with uppercase `T`, seconds, and `Z` or a numeric `+HH:MM`/`-HH:MM` offset. If fractional seconds are present, all digits must be zero. Reject invalid dates/offsets, leap-second values, date-only/naive timestamps, and locale-guessed formats. Convert the instant to Kolkata and require minute, second, and fraction all zero; the supplied offset itself need not be `+05:30`.
- Validate consumption from the original decoded text before Pandas numeric conversion. It must fully match `(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,4})?`. This admits zero and plain nonnegative decimals within `NUMERIC(14,4)` and rejects signs, leading-zero padding, exponents, separators, underscores, non-finite tokens, and more than four fractional digits (even trailing zeros). Reject invalid inputs; never round them into validity.
- Preserve record numbering through validation: the header is record 1. Check every well-formed data record up to the bounded row limit. For structural parsing failure or a resource limit, report discovered errors and stop; do not claim the rest of the file was validated. Structural/count failures may leave `total_rows` null. All validation failures reject the entire import and accept zero readings.

The UI may show these rules but the backend enforces them. Oversize CSVs should be split into smaller files with non-overlapping timestamps; compressed CSV ingestion is unsupported.

### Upload error-to-summary flow

A `201` already contains the terminal summary. On failure, render the normalized error envelope first. Fetch `GET /uploads/{upload_id}` only if that error contains `upload_id`; this supplies `status`, row counts, provenance, and `error_summary` for rejected uploads. If the follow-up fails, retain the original rejection and report that summary metadata is unavailable. Errors without `upload_id` do not trigger a summary fetch. `DUPLICATE_UPLOAD` displays `existing_upload_id` without automatically fetching a new/rejected summary. Known row totals minus zero accepted rows mean rows not imported, not a count of individually invalid records.

## Readings and analytics

`GET /buildings/{building_id}/readings?from=2026-01-01T00:00:00%2B05:30&to=2026-01-01T02:00:00%2B05:30`

```json
{
  "items": [
    { "id": "1", "upload_id": "22222222-2222-4222-8222-222222222222", "recorded_at": "2025-12-31T18:30:00Z", "consumption_kwh": "4.5000", "source_kind": "demo" },
    { "id": "2", "upload_id": "22222222-2222-4222-8222-222222222222", "recorded_at": "2025-12-31T19:30:00Z", "consumption_kwh": "4.5000", "source_kind": "demo" }
  ]
}
```

For the canonical showcase's first day, `GET /buildings/{building_id}/analytics?from=2026-01-08T00:00:00%2B05:30&to=2026-01-09T00:00:00%2B05:30` returns:

```json
{
  "building_id": "11111111-1111-4111-8111-111111111111",
  "from": "2026-01-07T18:30:00Z",
  "to": "2026-01-08T18:30:00Z",
  "timezone": "Asia/Kolkata",
  "source_kind": "demo",
  "observed_hours": 24,
  "expected_hours": 24,
  "missing_hours": 0,
  "coverage_fraction": 1.0,
  "total_kwh": "120.0000",
  "mean_hourly_kwh": "5.0000",
  "peak": { "recorded_at": "2026-01-07T20:30:00Z", "consumption_kwh": "10.0000" },
  "daily": [
    { "local_date": "2026-01-08", "total_kwh": "120.0000", "observed_hours": 24, "expected_hours": 24, "source_kind": "demo" }
  ]
}
```

Use the earliest UTC timestamp to break peak ties. Emit one daily entry per local date intersecting the requested window. A day with no readings has `total_kwh: null` and `source_kind: "none"`. A wholly empty window has null total/mean/peak, zero observed hours, and zero coverage; expected hours are still reported. `mean_hourly_kwh` is energy per observed hourly interval, not a measured power sample.

Means divide by observed hours, never expected hours. For example, `1120.5000 / 159` gives `7.0472` kWh per observed interval at 159/168 coverage (94.6% displayed), not `6.6696`. This is an arithmetic illustration, not a required second-building fixture or comparison UI. Display provenance per selected window. The readings endpoint returns observations only; the UI materializes missing timestamp slots as display-only null values rather than assuming `connectNulls=false` can detect omitted records.

## Run and inspect detection

`POST /buildings/{building_id}/anomaly-runs`

```json
{ "from": "2026-01-08T00:00:00+05:30", "to": "2026-01-15T00:00:00+05:30" }
```

`200` for the canonical showcase, including both alert objects:

```json
{
  "method_version": "hourly_mad_v1",
  "evaluated_readings": 168,
  "eligible_readings": 168,
  "skipped_insufficient_history": 0,
  "alert_count": 2,
  "evaluated_at": "2026-01-30T10:02:00Z",
  "items": [
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "building_id": "11111111-1111-4111-8111-111111111111",
      "reading_id": "171",
      "recorded_at": "2026-01-07T20:30:00Z",
      "method_version": "hourly_mad_v1",
      "observed_kwh": "10.0000",
      "baseline_kwh": "5.0000",
      "mad_kwh": "0.5000",
      "threshold_kwh": "7.2239",
      "sample_count": 7,
      "source_kind": "demo",
      "explanation": "10.0000 kWh exceeds 7.2239 kWh; median 5.0000 kWh from 7 earlier readings at this local hour.",
      "evaluated_at": "2026-01-30T10:02:00Z"
    },
    {
      "id": "33333333-3333-4333-8333-333333333334",
      "building_id": "11111111-1111-4111-8111-111111111111",
      "reading_id": "198",
      "recorded_at": "2026-01-08T23:30:00Z",
      "method_version": "hourly_mad_v1",
      "observed_kwh": "10.0000",
      "baseline_kwh": "5.0000",
      "mad_kwh": "0.5000",
      "threshold_kwh": "7.2239",
      "sample_count": 8,
      "source_kind": "demo",
      "explanation": "10.0000 kWh exceeds 7.2239 kWh; median 5.0000 kWh from 8 earlier readings at this local hour.",
      "evaluated_at": "2026-01-30T10:02:00Z"
    }
  ]
}
```

`evaluated_readings = eligible_readings + skipped_insufficient_history`; missing input hours are not evaluated. `alert_count` is the number of qualifying alerts after reconciliation, not newly inserted rows. `GET /alerts` returns the same alert objects within `{ "items": [...] }`. Show evaluation time and rerun after historical imports; reading alerts alone does not refresh their evidence.

Run counts and the whole-window evaluation time are transient results of the immediate POST, not recoverable from alert GETs. Clear them on building/range changes, reload, or successful imports for the active building; ignore late responses for old context. An empty GET means no stored alerts, not a completed clean run. A POST with zero evaluated readings means no readings; zero eligible with positive skipped means insufficient history. With positive eligibility, report alerts among eligible readings, plus skipped and missing hours. Only describe a fully evaluated observed window when skipped is zero; never claim missing or skipped intervals were below thresholds. Thresholds/medians are available only on alerts: charts fetch readings plus alert markers, without a continuous threshold series.

## Create and run a scenario

`POST /buildings/{building_id}/scenarios`

```json
{
  "name": "Selected off-hours reduction",
  "reduction_percent": "20.00",
  "target_hours_local": [0, 1, 2, 3, 4, 5, 6, 18, 19, 20, 21, 22, 23],
  "target_weekdays_local": [0, 1, 2, 3, 4, 5, 6]
}
```

`201` returns those fields with `id`, `building_id`, and `created_at`; individual GET uses the same shape. Hours and weekdays must be nonempty, unique integer arrays in their documented ranges; responses sort them. Percentage must be greater than zero and at most 50. Create a new scenario to change assumptions.

The example's 13 selected hours are labeled “After-hours 18:00–07:00, end exclusive.” This is an assumption preset, not a building operating schedule. No scenario-level tariff override is accepted.

`POST /scenarios/44444444-4444-4444-8444-444444444444/runs`

```json
{ "from": "2026-01-08T00:00:00+05:30", "to": "2026-01-15T00:00:00+05:30" }
```

`201` for the canonical complete 168-hour showcase (840 total kWh; 420 selected kWh):

```json
{
  "id": "55555555-5555-4555-8555-555555555555",
  "building_id": "11111111-1111-4111-8111-111111111111",
  "scenario_id": "44444444-4444-4444-8444-444444444444",
  "baseline_from": "2026-01-07T18:30:00Z",
  "baseline_to": "2026-01-14T18:30:00Z",
  "baseline_kwh": "840.0000",
  "targeted_baseline_kwh": "420.0000",
  "hypothetical_kwh": "756.0000",
  "estimated_savings_kwh": "84.0000",
  "estimated_cost_savings": "672.0000",
  "source_hour_count": 168,
  "source_kind": "demo",
  "rate_per_kwh": "8.0000",
  "currency": "INR",
  "model_version": "targeted_percent_reduction_v1",
  "calculated_at": "2026-01-30T10:03:00Z"
}
```

`GET /simulation-results/{result_id}` returns this saved snapshot. Fetch its immutable scenario for the selected hours and percentage. No result is written for an incomplete baseline; complete zero-energy baselines and zero matching hours return valid zero-savings results.

Bind presentation to the returned building/scenario IDs, `baseline_from`/`baseline_to`, `rate_per_kwh`, `currency`, `source_hour_count`, and the immutable linked scenario definition. Clear the visible current result when building/scenario/definition/range changes, a new run starts, or a successful import affects the building. Ignore late responses for older context. A retrieved historical result must be labeled as a saved snapshot and cannot inherit current unsaved controls. Complete one-hour periods are allowed; simulation does not require a seven-day statistical history.

## Errors and persistence

All application errors, including framework validation errors, use this envelope; omit inapplicable optional fields:

```json
{
  "error": {
    "code": "CSV_VALIDATION_FAILED",
    "message": "Upload rejected; no readings were imported.",
    "upload_id": "66666666-6666-4666-8666-666666666666",
    "error_count": 1,
    "details": [
      { "row": 3, "field": "consumption_kwh", "code": "NEGATIVE_VALUE", "message": "Use a finite nonnegative kWh value." }
    ]
  }
}
```

CSV header is row 1; detail rows use the CSV record number, including the header, rather than a Pandas index. Embedded field newlines are prohibited by the CSV grammar. Request-field errors use a `field` path and omit `row`. `details` is always an array of objects, capped at 20, and is `[]` when there are no details. `error_count`, when applicable to CSV validation, counts all discovered validation errors, not invalid rows or errors in an unparsed remainder. The persisted rejected-upload `error_summary` uses the same code/message/error_count/details fields. Framework errors are translated into this envelope.

- `400 MALFORMED_REQUEST`: invalid JSON or multipart framing; generally no upload record.
- `404 RESOURCE_NOT_FOUND`: missing building/upload/scenario/result.
- `409 DUPLICATE_UPLOAD`: same building and SHA-256 as an earlier successful import; include `existing_upload_id`, create no new upload/readings. This applies even if requested provenance differs; re-uploading cannot relabel data.
- `409 READING_CONFLICT`: at least one instant already stored; save a rejected upload after rollback and return its `upload_id` plus up to 20 detail objects with `field: "timestamp"`, `code: "READING_CONFLICT"`, `recorded_at`, and `message`. Concurrent insert races map to this same contract; concurrent identical files map to duplicate upload. Do not label a capped detail count as the total conflict count.
- `413 FILE_TOO_LARGE`: over 5 MiB; reject before full parsing and create no upload record.
- `415 UNSUPPORTED_FILE_TYPE`: disallowed filename/MIME combination; no upload record required.
- `422 VALIDATION_ERROR`: invalid request fields, UUID, unsupported timezone (anything other than `Asia/Kolkata`), or scenario parameters; no mutation.
- `422 CSV_VALIDATION_FAILED`: empty file, malformed UTF-8/CSV, wrong headers, over 10,000 rows, invalid timestamps/numbers, or intra-file duplicates; save rejected upload metadata, never readings. `total_rows` may be null when parsing fails.
- `422 INVALID_TIME_RANGE`: invalid offsets/boundaries, duration, or order.
- `422 INCOMPLETE_BASELINE`: `details` contains one object with `observed_hours`, `expected_hours`, and `missing_hours`; save no simulation result. Reject missing non-targeted hours too; complete zero-energy/no-match baselines are valid.
- `500 INTERNAL_ERROR`: generic message without stack traces or SQL; rollback failed work.
- `503 DATABASE_UNAVAILABLE`: no success claim; upload rejection metadata may not be persisted.

Validation precedence: resolve the building and validate multipart fields/type/size, check successful byte duplicate, validate CSV contents, then check stored timestamp overlap. Return `422` for an intra-file duplicate; use `409` only for conflicts with already stored data. A successful/rejected upload summary never has a pending state.

For the canonical missing-hour variant, the incomplete-baseline error is:

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
