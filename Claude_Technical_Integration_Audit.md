# **WattWise AI + GridTwin Lite — Technical Integration Audit**

**Mode:** Plan/Review (Read-Only)
**Gravitas Policy Record:**

```
json
```

{

"planning": "deep",

"context_depth": "full",

"verification_depth": "impact",

"delegation": "none",

"reason_codes": ["cross-system-integration", "frozen-contract", "48h-hackathon-risk"]

}

**Evidence basis:** Direct document reads of all seven planning files this session. No application code exists yet; all findings compare the two previous-turn implementation plans against the frozen specifications. Claimed verification = what was observed in the documents; nothing more.

---

## **A. Critical Integration Blockers**

CAUTION

---

### **BLOCKER 1 — Building Explorer Screen: Explicitly Forbidden by UI_SPEC.md**

**Source:** `UI_SPEC.md` §Scope and authority, line 11, `AGENTS.md` §Frozen MVP, line 20

**Finding:** Both implementation plans (the earlier plan and the most recent) specify a fifth screen called **Building Explorer** with components: `BuildingExplorerView.tsx`, `BuildingDirectoryStrip.tsx`, `BuildingProfileCard.tsx`, `ConfiguredSchedulesCard.tsx`, and `RegisterBuildingModal.tsx`. The frozen specification explicitly rejects this:

> "There is no separate Building Explorer screen, invented campus endpoint, continuous threshold series, equipment model, or editable operating schedule."
>
> &#x20; — `UI_SPEC.md` §Scope and authority

> "Campus rollups, building comparison, diurnal analytics, virtualization, general DST/cross-timezone support, and advanced polish are deferred."
>
> &#x20; — `AGENTS.md` §Frozen MVP

**The frozen MVP has exactly four views/tabs:** Selected-building overview, Data Studio, Anomalies, and GridTwin Lite. The building creation/selection is part of the **shared shell**, not a fifth screen.

**Impact:** If implemented, this screen creates dead-end API calls for features that don't exist (building comparison, diurnal profiles via readings), wastes sprint time (H30–H36 already tight), and violates scope. The `DiurnalProfileChart.tsx` and `BuildingComparisonTable.tsx` components are also out-of-scope artifacts.

**Required correction:** Collapse Building Explorer into the shared shell. The "Register Building" form lives in the building selector (as `AppShell` context), not as a dedicated screen. Eliminate the `BuildingExplorer/` folder entirely.

---

### **BLOCKER 2 — Building Comparison: Deferred, No API Endpoint Exists**

**Source:** `API_CONTRACT.md` §Shared rules, line 13, `UI_SPEC.md` §Selected-building overview, line 37

**Finding:** The implementation plan proposes `BuildingComparisonTable.tsx` fetching analytics for two buildings simultaneously and a comparison metrics grid. The API contract and UI spec both explicitly prohibit this:

> "There is no building comparison request or campus total."
>
> &#x20; — `UI_SPEC.md` §Selected-building overview

> "This contract remains building-scoped: no campus rollup/comparison, diurnal endpoint..."
>
> &#x20; — `API_CONTRACT.md` §Shared rules

The arithmetic illustration in `API_CONTRACT.md` ("1120.5000 / 159 gives 7.0472") is **explicitly labeled** "not a required second-building fixture or comparison UI."

**Impact:** Any comparison UI code will orphaned with no backend support and violates the frozen MVP scope.

---

### **BLOCKER 3 — Continuous Threshold Line on Anomaly Chart: Explicitly Forbidden**

**Source:** `ARCHITECTURE.md` §Explainable detector, line 56, `UI_SPEC.md` §Anomaly Investigator, line 93, `AGENTS.md` line 37

**Finding:** The implementation plan's `AnomalyComposedChart.tsx` renders a `<Line dataKey="threshold_kwh" ...>` as a continuous dashed threshold line across the full time window. The specifications explicitly forbid this:

> "There is **no continuous threshold/median line**: the API has no thresholds for non-alert readings, and the client must not synthesize them."
>
> &#x20; — `UI_SPEC.md`

> "Anomaly charts use readings plus alert markers; thresholds appear only in alert evidence."
>
> &#x20; — `AGENTS.md`

> "The client must not synthesize [thresholds] for non-alert readings."
>
> &#x20; — `ARCHITECTURE.md`

The threshold `7.2239` exists **only** in alert objects. Non-flagged readings have no associated threshold. Drawing a continuous line would require the frontend to fabricate threshold values it does not possess — a direct contract violation.

**Required correction:** `AnomalyComposedChart.tsx` renders: (1) a consumption line from readings, and (2) alert dot/marker overlays at the specific timestamps where alerts exist. No threshold line. Thresholds are shown only in the inline evidence table below the chart.

---

### **BLOCKER 4 — `connectNulls={false}` Is Insufficient for Gap Detection**

**Source:** `UI_SPEC.md` §Honest missing-data rendering, line 50, `ARCHITECTURE.md` §Time, coverage, and precision, line 56

**Finding:** The implementation plans state "Recharts automatically breaks the line whenever `consumption_kwh === null`". This is insufficient. The specification requires:

> "The UI constructs an hourly UTC display grid over `[from,to)` and joins returned readings onto it. Missing instants get null chart values... **Omitted API records alone do not create chart gaps.**"
>
> &#x20; — `UI_SPEC.md`

If the frontend simply plots `readings` items directly from `GET /readings`, a missing reading produces **no data point at all** — Recharts skips it and the line appears unbroken. The frontend **must** pre-build the complete UTC tick grid independently, then join the API data onto it, inserting explicit `null` values for missing hours.

**Required correction:** Before charting, client code must generate every expected UTC hourly timestamp in `[from, to)`, produce an array of `N` points (one per expected hour), and set `consumption_kwh: null` for each position where no API reading exists. Only then does `connectNulls={false}` work correctly.

---

### **BLOCKER 5 — Detection Summary State: Eligible/Skipped Counts Not Recoverable from GET /alerts**

**Source:** `AGENTS.md` line 37, `UI_SPEC.md` §Evaluation state rules, line 99, `ARCHITECTURE.md` §Explainable detector, line 70

**Finding:** The implementation plans propose that `SummaryStatStrip.tsx` populates count cards from `GET /buildings/{id}/alerts`. The specification explicitly forbids this:

> "Eligible/skipped counts come only from the immediate detection POST response for the active building/range, never from stored alerts."
>
> &#x20; — `AGENTS.md`

> "Only the immediate successful POST supplies the displayed run counts/time; do not reconstruct them from GET results."
>
> &#x20; — `UI_SPEC.md`

> "An empty GET means no stored alerts, not a completed clean evaluation."
>
> &#x20; — `UI_SPEC.md`

The five-state machine (No-run / Running / No-readings / Insufficient-history / Partial-eligibility / Completed) must be driven exclusively from the transient `POST /anomaly-runs` response. On page reload, range changes, or building switches, all counts and the "last evaluated" timestamp must be **cleared**, not restored from GET results.

**Impact:** If counts are incorrectly shown from GET results, the UI will falsely claim anomaly detection has completed a clean run when it hasn't, violating acceptance criterion 7.

---

### **BLOCKER 6 — Mean Hourly Energy Label: `kWh/hr` is Explicitly Prohibited**

**Source:** `AGENTS.md` line 33, `UI_SPEC.md` §Inputs and layout, line 43

**Finding:** Both implementation plans label the mean KPI card as `kWh/hr`. This is explicitly forbidden:

> "Label energy in kWh per interval, not kWh/hr or peak demand."
>
> &#x20; — `AGENTS.md`

> "Mean energy per observed one-hour interval: `mean_hourly_kwh`, in kWh; never label it kWh/hr."
>
> &#x20; — `UI_SPEC.md`

Similarly, the peak card must not be labeled "Peak Demand" — it is "Peak hourly energy."

---

### **BLOCKER 7 — Upload Error Flow: Incorrect Summary Fetch Logic**

**Source:** `API_CONTRACT.md` §Upload error-to-summary flow, line 107, `UI_SPEC.md` §Response handling, line 73

**Finding:** Both plans state: "on rejection (422 CSV_VALIDATION_FAILED), renders the Error Inspector table." This is partially correct but misses critical conditional logic:

The contract defines a two-step flow:

1. On **any** non-201 response, display the error envelope immediately.
2. **If and only if** `error.upload_id` exists in the response, then — and only then — fetch `GET /uploads/{upload_id}` for the full rejected summary.
3. `DUPLICATE_UPLOAD` shows `existing_upload_id` but does **NOT** trigger a summary fetch.
4. Errors without `upload_id` (e.g., `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_FILE_TYPE`) must NOT attempt a summary fetch, as no upload record was created.

The implementation plans do not make this conditional branching explicit. The code path "render ErrorInspectorTable on 422" will fail silently for `413` and `415` errors that have no `upload_id` and no upload record.

**Required correction:** The upload response handler must explicitly branch: `if (error.upload_id) { fetch GET /uploads/{id} }` with fallback, not a blanket fetch on any non-201.

---

## **B. Major Issues**

WARNING

---

### **MAJOR 1 — TypeScript `UploadSummary`: `first_recorded_at`/`last_recorded_at` Semantics Misunderstood**

**Source:** `API_CONTRACT.md` §Upload and inspect, line 90

**Finding:** The proposed `UploadSummary` interface correctly marks `first_recorded_at: string | null` and `last_recorded_at: string | null`. However, the implementation plan's display description ("Covered Timestamps: `first_recorded_at` to `last_recorded_at`") implies it represents the full coverage end. It does not:

> "`last_recorded_at` is the final interval's **start**, not the exclusive coverage end."
>
> &#x20; — `API_CONTRACT.md`

For a 336-row file, `last_recorded_at = "2026-01-14T17:30:00Z"` but the exclusive coverage end is `"2026-01-14T18:30:00Z"` (one hour later). The UI must display this correctly — the UI_SPEC even specifies the exact text: "last start January 14 23:00 +05:30 ... exclusive extent end January 15 00:00 +05:30."

---

### **MAJOR 2 — `INCOMPLETE_BASELINE` Error: `details` Is an Array, Not an Object**

**Source:** `API_CONTRACT.md` §Errors and persistence, line 284, `UI_SPEC.md` §Baseline and error states

**Finding:** The implementation plan's `ApiErrorDetail` interface is defined as:

```
typescript
```

interface ApiErrorDetail {

  row?: number;

  field?: string;

  code: string;

  message: string;

}

But for `INCOMPLETE_BASELINE`, the detail object has a completely different shape:

```
json
```

{ "observed_hours": 167, "expected_hours": 168, "missing_hours": 1 }

This object has **no `code`, no `field`, no `message`, no `row`**. The `ApiErrorDetail` type is wrong for this case.

Additionally, the UI must read `error.details[0].observed_hours` — it is always `details[0]`, the **first element** of an array. Code that accesses `error.details.observed_hours` directly will fail.

**Required correction:** The type must discriminate between different `details` shapes, or use a union type. The `INCOMPLETE_BASELINE` handler must use `error.details[0]`.

---

### **MAJOR 3 — `READING_CONFLICT` Error: Detail Object Shape Differs from CSV Errors**

**Source:** `API_CONTRACT.md` §Errors, line 278

**Finding:** For `READING_CONFLICT`, the `details` objects have the shape:

```
json
```

{ "field": "timestamp", "code": "READING_CONFLICT", "recorded_at": "...", "message": "..." }

Note the extra field `recorded_at` and no `row` field. The generic `ApiErrorDetail` type misses `recorded_at` entirely, so accessing `.recorded_at` in the conflict display will be a TypeScript error or silent `undefined`.

---

### **MAJOR 4 — `reduction_percent` Field Type: String, Not Number**

**Source:** `API_CONTRACT.md` §Shared rules, line 8

**Finding:** The proposed `ScenarioCreateRequest` correctly defines `reduction_percent: string`. However, the implementation plan describes a slider input that naturally produces a JavaScript number. The serialization layer must explicitly convert the slider value to a four-decimal string (e.g., `"20.00"`) before submission, since the backend rejects extra-precision numbers and the contract states all energy/money/percentage values are decimal strings.

---

### **MAJOR 5 — Simulation Result Card Context Invalidation: Insufficient Triggers**

**Source:** `UI_SPEC.md` §Context changes and late responses, `ARCHITECTURE.md` §Scenario calculator, line 84

**Finding:** The implementation plan mentions clearing results "when the building, selected scenario, active scenario definition, or baseline range changes." But the specification adds a critical fourth trigger: a **successful upload for the active building** also invalidates the visible result:

> "A successful upload for the building invalidates its reads, detection summary, and visible current result."
>
> &#x20; — `UI_SPEC.md`

This means the `DataStudio` upload completion event must propagate to clear the Command Center KPIs, the anomaly detection summary, AND the GridTwin result — all simultaneously. This cross-screen state invalidation is not wired in the proposed component tree.

---

### **MAJOR 6 — Diurnal Profile Chart Is Explicitly Out of Scope**

**Source:** `UI_SPEC.md` §Scope, line 11, `AGENTS.md` line 20

**Finding:** Both plans include `DiurnalProfileChart.tsx`. The UI_SPEC explicitly states:

> "No diurnal chart is required."

> "Campus rollups, building comparison, diurnal analytics... are deferred."

This component should not be implemented.

---

### **MAJOR 7 — Timezone Scope Is Asia/Kolkata Only; Type Definitions Must Enforce This**

**Source:** `API_CONTRACT.md` §Shared rules, line 7, `AGENTS.md` line 33

**Finding:** The `BuildingCreateRequest` type exposes an open `timezone: string` field. During the sprint, the frontend must:

1. Display `timezone` as a **read-only** `Asia/Kolkata` field, not a free-form input.
2. The UI_SPEC states: "Timezone is a read-only `Asia/Kolkata` field submitted with the request."
3. The form must hardcode this value; no timezone dropdown/selector is needed or appropriate.

This is a scope savings as well — no IANA timezone list or validation logic is needed in the frontend.

---

### **MAJOR 8 — Tailwind CSS: Not in Frozen Stack; Requires Decision**

**Source:** `AGENTS.md` line 30, `UI_SPEC.md` §Scope, line 7

**Finding:** Both implementation plans assume Tailwind CSS as the styling system. The `AGENTS.md` engineering rules specify:

> "Use the agreed stack: React + TypeScript + Vite + Recharts; FastAPI + Pandas; PostgreSQL + SQLAlchemy + Alembic."

The `UI_SPEC.md` states:

> "Use React + TypeScript + Vite + Recharts and ordinary CSS; **no additional styling framework is required.**"

Tailwind CSS is not in the frozen stack. Installing it adds a dependency manifests/lockfile change (`package.json`, `tailwind.config.js`, `postcss.config.js`) that may not be authorized pre-sprint.

**Required decision:** Either (a) the owner explicitly authorizes Tailwind in the stack before H0 and it is declared in the stack upfront, or (b) styling uses plain CSS with CSS custom properties (which the UI_SPEC explicitly endorses with the six `--token` variables). The current plans have created `tailwind.config.js` in their folder structure, which constitutes an unauthorized dependency manifest in the pre-sprint phase.

---

## **C. Minor Issues**

NOTE

---

### **MINOR 1 — Anomaly Evidence "Elevation %" Badge: Client Calculation**

The plans propose a client-side elevation delta badge: `((obs - thresh) / thresh * 100%)`. `ARCHITECTURE.md` and `AGENTS.md` both state "the frontend must not independently calculate authoritative savings or thresholds." An elevation percentage is computed from already-returned values (not synthesizing new data), but it should be clearly labeled as a **display convenience** (e.g., "Note: Margin above threshold") not a backend-classified severity.

---

### **MINOR 2 — `AnomalyRunResponse` Type: Missing `items` Field in Some Previous Plans**

The full contract shape includes `items: AnomalyAlert[]` in the `POST /anomaly-runs` 200 response. The full run response returns alert objects directly — the chart and table can be populated from this response without a separate `GET /alerts` call. `GET /alerts` is for reloads without re-running.

---

### **MINOR 3 — Scenario Preset Label Must Be Exact**

**Source:** `UI_SPEC.md` §GridTwin Lite, line 123, `API_CONTRACT.md` §Scenarios, line 220

The after-hours preset must be labeled exactly **"After-hours 18:00–07:00, end exclusive"** (not "After-Hours (18–06)" as the plans state). It selects hours `[0,1,2,3,4,5,6,18,19,20,21,22,23]` — that is 13 hours covering midnight to 07:00 and 18:00 to midnight.

---

### **MINOR 4 — Peak Card: Do Not Say "Peak Demand"**

**Source:** `UI_SPEC.md` §Inputs and layout, line 43

The third KPI card must be labeled "Peak hourly energy" in kWh, never "Peak Demand" (which implies a power quantity in kW).

---

### **MINOR 5 — "Save Before Run" for Scenarios: Hard Constraint**

**Source:** `UI_SPEC.md` §GridTwin Lite, line 125

The form must not allow `POST /scenarios/{id}/runs` unless a **saved, selected, immutable** scenario exists. An unsaved form state must not be treated as the active definition. This must be a hard UI gate, not a soft warning.

---

### **MINOR 6 — Demo Data Label: `last_recorded_at` Example in API Contract Updated**

The API contract's upload example now shows 336 rows (not 2), `first_recorded_at: "2025-12-31T18:30:00Z"`, `last_recorded_at: "2026-01-14T17:30:00Z"`. The earlier implementations showed `total_rows: 2`. Any mock data or UI fixture text should match the 336-row canonical demo.

---

### **MINOR 7 — No Complex Modal Required for Building Form**

**Source:** `UI_SPEC.md` §Shared errors, line 163

> "Prefer inline evidence/building forms over complex modals."

The `RegisterBuildingModal.tsx` component (a focus-trapping modal dialog) is unnecessary complexity. A simple inline form or collapsible panel is sufficient and preferable per spec.

---

### **MINOR 8 — `error.details` Is Always an Array, Even When Empty**

**Source:** `API_CONTRACT.md` §Errors, line 273

> "`details` is always an array of objects, capped at 20, and is `[]` when there are no details."

All error handlers must treat `error.details` as `object[]`, never as `null` or `undefined`. Type definitions should reflect `details: object[]` as always present on the envelope.

---

## **D. Recommended Corrections**

| Priority     | Correction                                                                            | Impacted Component(s)                                                          |
| ------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Critical** | Remove Building Explorer screen entirely; fold building creation into AppShell        | `BuildingExplorer/` folder (delete), `AppShell.tsx` (add inline building form) |
| **Critical** | Remove BuildingComparisonTable and all multi-building analytics                       | `BuildingComparisonTable.tsx` (delete)                                         |
| **Critical** | Remove continuous threshold line from AnomalyComposedChart                            | `AnomalyComposedChart.tsx` → readings line + alert dots only                   |
| **Critical** | Pre-build UTC tick grid before charting; don't rely on `connectNulls` alone           | `TimeSeriesChart.tsx` → `buildDisplayGrid(from, to, readings)` utility         |
| **Critical** | Drive detection stat cards only from POST response; clear on context change           | `SummaryStatStrip.tsx`, `AnomalyInvestigatorView.tsx`                          |
| **Critical** | Fix mean label to "kWh" (not "kWh/hr"), peak to "Peak hourly energy"                  | `KpiSection.tsx`                                                               |
| **Critical** | Conditional upload summary fetch: only if `error.upload_id` present                   | `uploadsApi.ts`, `DataStudioView.tsx`                                          |
| **High**     | Discriminate `INCOMPLETE_BASELINE` detail shape from CSV error shape                  | `api.ts` type definitions                                                      |
| **High**     | Add `recorded_at` to conflict detail type                                             | `api.ts` — `ReadingConflictDetail` type                                        |
| **High**     | Hardcode `timezone: "Asia/Kolkata"` in building form; remove any selector             | `RegisterBuildingModal.tsx` (or inline form)                                   |
| **High**     | Wire successful upload → clear analytics, detection summary, and simulation result    | Cross-screen via `BuildingContext` or event bus                                |
| **High**     | Decide on Tailwind vs plain CSS before H0 and lock it in `AGENTS.md`                  | All styling                                                                    |
| **Medium**   | Display `last_recorded_at` as interval start with explicit `+1 hour` for coverage end | `ValidationSummaryCard.tsx`                                                    |
| **Medium**   | Hard gate: disable Run Simulation until a saved scenario is selected                  | `GridTwinSimulatorView.tsx`                                                    |
| **Medium**   | Fix preset label to "After-hours 18:00–07:00, end exclusive"                          | `HourMatrixGrid.tsx` preset button                                             |
| **Low**      | Remove `DiurnalProfileChart.tsx`                                                      | Delete from `charts/`                                                          |
| **Low**      | Prefer inline building form over complex modal                                        | Simplify `RegisterBuildingModal.tsx`                                           |

---

## **E. Frontend/Backend Handoff Checklist**

### **Gate 1 — H4: Foundation (Codex delivers, Antigravity verifies)**

- PostgreSQL 17 running locally on Windows 11 (PowerShell service check: `pg_ctl status`)
- Alembic migration creates all six tables cleanly (`alembic upgrade head`)
- `POST /buildings` with `{"name": "Campus Block A", "timezone": "Asia/Kolkata", "electricity_rate_per_kwh": "8.0000", "currency": "INR"}` returns `201` with UUID
- `GET /buildings?limit=50&offset=0` returns `{ items: [...], limit: 50, offset: 0, total: 1 }`
- Non-`Asia/Kolkata` timezone returns `422 VALIDATION_ERROR`
- CORS allows local Vite dev server origin (`http://localhost:5173`)
- Antigravity: Vite dev server starts, building switcher populates, AppShell renders

### **Gate 2 — H10: Ingestion (Codex delivers, Antigravity verifies)**

- `POST /buildings/{id}/uploads` multipart with `file` + `source_kind` returns `201` with 336-row summary
- `first_recorded_at: "2025-12-31T18:30:00Z"`, `last_recorded_at: "2026-01-14T17:30:00Z"`
- CSV with negative value → `422 CSV_VALIDATION_FAILED` with `upload_id`, error detail contains `row: N`, `field: "consumption_kwh"`, `code: "NEGATIVE_VALUE"`
- `GET /uploads/{upload_id}` returns same shape as POST response
- Identical byte re-upload → `409 DUPLICATE_UPLOAD` with `existing_upload_id`
- Antigravity: Data Studio shows 336 accepted rows; error table shows row-level detail on 422; no summary fetch on 413

### **Gate 3 — H15: Analytics (Codex delivers, Antigravity verifies)**

- `GET /analytics?from=2026-01-08T00:00:00%2B05:30&to=2026-01-15T00:00:00%2B05:30` returns `total_kwh: "840.0000"`, `mean_hourly_kwh: "5.0000"`, `observed_hours: 168`, `coverage_fraction: 1.0`
- `GET /readings` returns items with `recorded_at` as UTC, `consumption_kwh` as 4-decimal string, `source_kind`
- Missing-hour variant: `coverage_fraction < 1.0`, `missing_hours: 1`
- Antigravity: 168 UTC ticks pre-built; null inserted where no reading; line breaks at gap; KPI cards show exact fixture values; mean labeled "kWh"

### **Gate 4 — H19: Anomalies (Codex delivers, Antigravity verifies)**

- `POST /anomaly-runs` with showcase range → `200`, `evaluated_readings: 168`, `eligible_readings: 168`, `skipped_insufficient_history: 0`, `alert_count: 2`
- Warm-up range → `eligible_readings: 0`, `skipped_insufficient_history: 168`
- `GET /alerts` returns same alert objects within `{ items: [...] }` — no run counts in this response
- Alert `sample_count: 7` for first alert, `sample_count: 8` for second
- Antigravity: Five detection states correctly handled; reading GET before POST shows stored alerts with "No run" label; POST clears old summary and sets new counts; no continuous threshold line rendered

### **Gate 5 — H23: Simulations (Codex delivers, Antigravity verifies)**

- `POST /scenarios` with 13 hours, all weekdays, `"reduction_percent": "20.00"` → `201` with `id`
- `POST /scenarios/{id}/runs` with showcase range → `201`, `baseline_kwh: "840.0000"`, `estimated_savings_kwh: "84.0000"`, `estimated_cost_savings: "672.0000"`
- Missing-hour variant → `422 INCOMPLETE_BASELINE`, `details[0].missing_hours: 1`
- Antigravity: Sim result card bound to returned IDs; clear on building/scenario/range change; `details[0]` (not `details.missing_hours`) read for counts; "After-hours 18:00–07:00, end exclusive" preset label

### **Gate 6 — H36: Integration (Full walkthrough)**

- `tsc --noEmit` passes with zero errors
- `vite build` produces clean `dist/` bundle
- Full demo flow: create building → upload 336 rows → view dashboard (840 kWh, 5.0000 mean) → run detection (2 alerts) → create scenario → run simulation (84 kWh, 672 INR) → all with `DEMO DATA` label visible
- Reload clears detection summary; cross-tab context invalidation works after new upload
- Error states: 413 (no upload ID shown), 415, 422 CSV (row detail), DUPLICATE, CONFLICT, INCOMPLETE_BASELINE
- Zero-result state: Monday-only scenario on January 8–9 returns savings `0.0000`

---

## **F. Final GO / NO-GO Readiness Assessment**

```
+------------------------------------------------------------------------------+
```

\| READINESS DIMENSION                         | STATUS     | BLOCKING?         |

+------------------------------------------------------------------------------+

\| API Contract (14 endpoints): Frozen & sound | PASS       | No                |

\| TypeScript types: Mostly correct            | CAUTION    | 2 shape errors    |

\| Screen count: Plans have 5, spec has 4      | FAIL       | YES — Blocker 1   |

\| Building comparison UI: Plans have it       | FAIL       | YES — Blocker 2   |

\| Continuous threshold line: Plans have it    | FAIL       | YES — Blocker 3   |

\| Gap rendering: Incorrect approach           | FAIL       | YES — Blocker 4   |

\| Detection state machine: Incomplete         | FAIL       | YES — Blocker 5   |

\| Mean/peak labels: Wrong units               | FAIL       | YES — Blocker 6   |

\| Upload error flow: Missing conditional      | FAIL       | YES — Blocker 7   |

\| Styling framework (Tailwind): Undecided     | CAUTION    | Decision needed   |

\| Incomplete baseline error parsing           | FAIL       | YES — Major 2     |

\| Timezone hardcoding: Missing from form      | CAUTION    | Yes — Major 7     |

\| Cross-screen invalidation after upload      | CAUTION    | Yes — Major 5     |

\| Windows 11 / no Docker compatibility        | PASS       | No (PostgreSQL    |

\|                                             |            | installs natively)|

\| 48h schedule: Tight but feasible if scoped  | CAUTION    | See below         |

+------------------------------------------------------------------------------+

### Overall Assessment: **NO-GO** on Current Plans

**Rationale:** Seven critical blockers and eight major issues have been identified that, if taken into implementation unchanged, would produce acceptance-criterion failures within the first four hours of the sprint:

- Wasted sprint hours on Building Explorer and comparison table (out of scope)
- Runtime visual errors from continuous threshold line (no API data to drive it)
- Silent chart gaps from incorrect gap rendering approach
- Wrong detection state management after page reload
- INCOMPLETE_BASELINE error parsing crash (`details.observed_hours` is `undefined`)

**Conditions for GO:**

1. Correct all seven critical blockers in this planning document or in a corrected implementation plan.
2. Owner explicitly confirms the styling framework decision (Tailwind vs. plain CSS) and records it.
3. Cross-screen invalidation strategy (post-upload clearing) is wired into the `BuildingContext` design.
4. TypeScript type definitions discriminate between the three `details` shapes (`CsvErrorDetail`, `ReadingConflictDetail`, `IncompleteBaselineDetail`).
5. The four-screen structure (Overview, Data Studio, Anomalies, GridTwin) is confirmed as the final layout before H0.

### **Windows 11 / No Docker Assessment**

PostgreSQL 17 installs natively on Windows via the official installer. Alembic and SQLAlchemy work without Docker. Vite and Node work on Windows PowerShell. This constraint is manageable — no blockers identified.

### Schedule Realism: The 29-hour implementation window is achievable **only** with the corrected 4-screen MVP scope. The Building Explorer screen was estimated to consume H30–H36. Removing it frees that block for what it was always intended for: integration, testing, and the six correctness checkpoint gates. With the reduced scope, the schedule is realistic.