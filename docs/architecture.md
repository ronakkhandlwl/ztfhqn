# Architecture & design notes

Audience: technical lead reviewing the pilot. Covers the shape of the system, why it is built this way, and where to
extend it.

## 1. System overview

```mermaid
flowchart LR
    subgraph Elexon["Elexon BMRS Insights API"]
        F[FUELHH stream<br/>half-hourly outturn]
        W[WINDFOR stream<br/>hourly forecasts, 8 runs/day]
    end

    subgraph Backend["backend/ (FastAPI, Python 3.12)"]
        C[data/elexon.py<br/>chunked client + retries]
        R[data/repository.py<br/>snapshot or live source]
        S[(data/*.csv.gz<br/>versioned snapshot)]
        D[domain/<br/>markets · selection · metrics · bands]
        SV[services/<br/>backtest → decision / accuracy / explorer]
        A[api/<br/>routes · schemas · middleware]
    end

    subgraph Frontend["frontend/ (React + TS)"]
        Q[api/ typed client<br/>TanStack Query cache]
        V[features/<br/>decision · accuracy · explorer]
    end

    F & W --> C --> R
    S --> R
    R --> SV
    D --> SV --> A -->|JSON /api/*| Q --> V
    C -. scripts/build_snapshot.py .-> S
```

Deployed as one Vercel project with two **services** (SPA + Python function) behind one origin; locally as two
containers (`api` + nginx `web`) via Docker Compose.

## 2. Backend layering

| Layer | Responsibility | Depends on |
| --- | --- | --- |
| `domain/` | Pure, framework-free logic on DataFrames: market calendar and gate closures (`markets.py`), "which forecast was available" (`selection.py`), error statistics (`metrics.py`), walk-forward bands (`bands.py`), schema normalisation (`frames.py`). | pandas/numpy only |
| `data/` | Getting data in: `ElexonClient` (chunking, retries, validation), `SnapshotSource` / `ElexonSource` behind a `DatasetSource` protocol, `load_dataset()` with live → snapshot fallback. | domain |
| `services/` | Use cases. `backtest.py` builds the core table (one row per delivery hour with the bid-time forecast, band, outturn, error). `decision.py`, `accuracy.py`, `explorer.py` project that table into read models (`views.py`). `analytics.py` is the facade with caching and input validation. | domain, data |
| `api/` | HTTP only: routes parse/validate query params, call the facade, return views serialised through Pydantic schemas (camelCase). Error mapping, CORS, gzip, cache headers, rate limiting. | services |

Rules followed: domain has no I/O; services have no HTTP; routes have no logic. Every public function is typed
(`mypy` clean) and every frozen dataclass is immutable.

### The core table (`services/backtest.py`)

For each delivery day *D* and auction:

1. `decision_window()` → gate closure on D-1 (UK local, DST-aware) → cutoff = gate − bid lead → delivery window
   23:00 D-1 → 23:00 D, all in UTC.
2. `forecast_at_cutoff()` → the latest WINDFOR run with `publishTime < cutoff` (a run released at the cutoff
   instant cannot be acted on), restricted to targets in the window
   with a non-negative horizon.
3. Join outturn on `startTime`; error = forecast − outturn.
4. `walk_forward_quantiles()` → for each day, P10/P50/P90 of errors **observable at the cutoff** (settlement period
   finished) within a trailing 28-day window. Band: `p10 = forecast − q90`, `p50 = forecast − q50`,
   `p90 = forecast − q10`.

Everything the UI shows for day-ahead decisions is a filter or aggregation of this one table, which keeps the numbers
consistent across views. It is computed once per (auction, bid lead) and cached in-process (bounded).

## 3. Key decisions and trade-offs

| Decision | Why | Trade-off / alternative |
| --- | --- | --- |
| **Serve a versioned snapshot by default**, live Elexon load optional | January 2026 is historical and immutable; snapshot gives fast cold starts on serverless, deterministic numbers for the client, and no runtime dependency on a third-party API. | Not live. `WINDDESK_DATA_SOURCE=elexon` + the same client covers live/refresh; a scheduled job writing to object storage would be the production path. |
| **Walk-forward bands** rather than in-sample quantiles | An honest backtest: a band for day D uses only errors known before D's bids. Lets us report calibration (86% coverage of a nominal 80% band). | Needs history before the first decision → December 2025 loaded as calibration data. Pooled, unconditional quantiles; conditioning on wind level would sharpen bands but needs more data. |
| **Exact `startTime` join** of hourly forecast to the half-hourly outturn period | Matches the dataset definitions in the brief and keeps the method explainable. | Averaging both half-hours changes MAE by < 1% on this data. |
| **Delivery day 23:00 → 23:00 UK** and real gate closures | Matches how GB day-ahead auctions actually trade, so "forecast available at decision time" is correct to the minute. | Slightly less intuitive than a calendar day; explained in-app. |
| **pandas** for analytics | Idiomatic, vectorised, well understood by reviewers; the dataset is tiny (~36k forecast rows). | Larger scope would move to Polars/DuckDB and precomputed aggregates. |
| **URL holds UI state** (`?date=&market=&lead=`) | Any view is a shareable link — useful for a trading desk. | — |
| **TanStack Query with infinite stale time** | Data is immutable per deployment; no refetch churn. API also sends CDN cache headers. | Would switch to time-based staleness in a live mode. |
| **Recharts + design tokens** | Composable React charts; colours are CSS variables validated for colour-blind separation in light and dark mode. | Heavier than hand-rolled SVG; split into its own chunk. |

## 4. Testing strategy

| Level | Where | What |
| --- | --- | --- |
| Unit (backend) | `backend/tests/unit/` | Gate-closure maths incl. BST and clock-change days, forecast selection edge cases (inclusive cutoff, no past targets, nothing published), metrics against hand-computed values, band look-ahead safety, Elexon client chunking/retries/bad payloads (httpx `MockTransport`), snapshot round-trip and live → snapshot fallback, config validation. |
| Service | `test_services.py` | Synthetic dataset where every run's value encodes its publish hour, so tests assert *which* run was chosen and the exact error/band. A look-ahead test corrupts all outturn and forecast runs unknowable at a cutoff and asserts that day's band is unchanged; clock-change (23 h) and partial-outturn days are covered. |
| Integration | `backend/tests/integration/test_api.py` | Full HTTP contract via `TestClient`: camelCase payloads, status codes (400/404/422/429/500), no leaked internals, cache headers. |
| Frontend | `frontend/src/**/*.test.ts(x)` | Pure models (row merging, narratives, insights), formatting and scales, API client error handling, and rendered pages with mocked `fetch` (market switch, outturn toggle, error state, explorer slider). |

Coverage gates in CI: backend ≥ 85% (currently ~98%), frontend lines ≥ 80% (currently ~88%).

## 5. Development practices

- **Typed end to end:** Pydantic response models ↔ TypeScript interfaces in `frontend/src/api/types.ts`.
- **Lint/format/type:** ruff + mypy (backend), oxlint + `tsc --strict` (frontend), all in CI.
- **CI:** `.github/workflows/ci.yml` runs both test suites with coverage gates and builds both Docker images.
- **Config by environment**, validated at startup (`config.py`); no secrets are required (Elexon API is open).
- **Defensive I/O:** external payloads are schema-checked and coerced; bad rows are dropped, not trusted.
- **Security basics:** GET-only CORS allow-list, per-IP rate limiting, generic 500s with server-side logging, security
  headers at the edge (Vercel/nginx), non-root container user.

## 6. Extending

- **Live daily mode:** schedule `build_snapshot` (cron) to object storage; switch the frontend to time-based staleness;
  add an alert when the newest run leaves yesterday's planning range.
- **Separate curtailment from forecast skill:** add BOALF / constraint volumes; today curtailed wind shows up as
  over-forecast in FUELHH.
- **Sharper bands:** condition quantiles on forecast level and lead time; evaluate with pinball loss.
- **More markets:** add an entry to `MARKETS` in `domain/markets.py` — everything else derives from it.
