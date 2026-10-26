import { useMeta } from '../../api/queries'
import { formatDayTime } from '../../lib/time'

export function MethodologyPage() {
  const { data: meta } = useMeta()
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Methodology</h1>
          <p>How the numbers in this pilot are produced, and what to keep in mind when using them.</p>
        </div>
      </div>
      <div className="card prose">
        <h2>Data</h2>
        <ul>
          <li>
            <strong>Outturn</strong> — Elexon BMRS <code>FUELHH</code>, <code>fuelType = WIND</code>:
            half-hourly metered generation of transmission-connected wind (MW).
          </li>
          <li>
            <strong>Forecast</strong> — Elexon BMRS <code>WINDFOR</code>: national wind generation
            forecast, hourly targets, published 8 times a day (02:30, 04:30, 07:30, 09:30, 11:30,
            15:30, 18:30, 22:30 UTC), each looking up to ~3 days ahead.
          </li>
          <li>
            Scope: purchase decisions made 1–31 January 2026, i.e. delivery days 2 Jan – 1 Feb.
            December 2025 is loaded only as error history for the first January decisions.
          </li>
          {meta && (
            <li>
              Snapshot retrieved {formatDayTime(meta.retrievedAt)} UK ({meta.dataSource}).
            </li>
          )}
        </ul>

        <h2>Which forecast was available at decision time?</h2>
        <p>
          GB day-ahead auctions trade a delivery day running 23:00 → 23:00 UK time. Bids must be in
          before gate closure on the previous day: 09:20 (EPEX hourly), 09:50 (Nord Pool N2EX) or
          15:30 (EPEX half-hourly). The desk finalises bids a configurable lead time before gate
          (default 30 min). The forecast shown is the most recent WINDFOR run whose{' '}
          <code>publishTime</code> is strictly before that cutoff — never a later one, and not one
          released at the cutoff instant. Only target hours in the future at publish time are used.
        </p>

        <h2>Error metrics</h2>
        <p>
          Error = forecast − outturn, compared at each hourly forecast target against the outturn of
          the settlement period starting at the same time. Positive error means the forecast
          over-stated wind and the shortfall must be bought later (intraday or imbalance).
        </p>
        <ul>
          <li><strong>MAE</strong> — mean absolute error, MW.</li>
          <li><strong>Bias</strong> — mean error; systematic over/under-forecasting.</li>
          <li><strong>RMSE</strong> — penalises large misses.</li>
          <li><strong>WAPE</strong> — total absolute error ÷ total outturn.</li>
          <li><strong>P10 / P90 error</strong> — 80% of hourly errors lie between these.</li>
        </ul>

        <h2>Plan-to number and planning range (walk-forward)</h2>
        <p>
          For each delivery day the app looks back over the trailing{' '}
          {meta?.bandWindowDays ?? 28} days of day-ahead errors that were <em>already known</em> at
          the bid cutoff (settlement periods that had finished), and takes the 10th, 50th and 90th
          percentile of error. Then:
        </p>
        <ul>
          <li><strong>P50 plan-to</strong> = forecast − median error (bias-adjusted).</li>
          <li><strong>P10 low-wind case</strong> = forecast − 90th percentile error.</li>
          <li><strong>P90 high-wind case</strong> = forecast − 10th percentile error.</li>
        </ul>
        <p>
          Because only past errors are used, the accuracy page is an honest backtest of what the desk
          would have seen. Daily energy ranges sum the hourly P10/P90 values, which assumes errors
          move together through the day (typical for weather-driven wind errors).
        </p>

        <h2>Limitations &amp; next steps</h2>
        <ul>
          <li>
            FUELHH is metered output, so curtailed wind (constraint actions on windy days) appears as
            over-forecast. Adding BOALF/constraint data would separate forecast skill from
            curtailment.
          </li>
          <li>
            Embedded (distribution-connected) wind and solar are outside both datasets; they reduce
            demand seen by the transmission system and matter for total procurement.
          </li>
          <li>
            One month is a small sample. Bands conditioned on wind level, season and lead time would
            sharpen with more history.
          </li>
          <li>Next: live daily mode, alerts when the latest run moves outside yesterday's range.</li>
        </ul>
      </div>
    </>
  )
}
