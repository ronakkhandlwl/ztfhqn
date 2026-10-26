import type { Decision } from '../../api/types'
import { hours, mw, signedPower } from '../../lib/format'
import { formatTime } from '../../lib/time'

export function HourlyTable({ decision }: { decision: Decision }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Hour (UK)</th>
            <th scope="col">Lead time</th>
            <th scope="col">Forecast</th>
            <th scope="col">P10 (low)</th>
            <th scope="col">P50 plan-to</th>
            <th scope="col">P90 (high)</th>
            <th scope="col">Outturn</th>
            <th scope="col">Error (fcst − outturn)</th>
          </tr>
        </thead>
        <tbody>
          {decision.hours.map((h) => {
            const outside =
              h.actual !== null &&
              h.p10 !== null &&
              h.p90 !== null &&
              (h.actual < h.p10 || h.actual > h.p90)
            return (
              <tr key={h.startTime} className={outside ? 'row-flag' : undefined}>
                <td>{formatTime(h.startTime)}</td>
                <td>{hours(h.horizonH)}</td>
                <td>{mw(h.forecast)}</td>
                <td>{mw(h.p10)}</td>
                <td>{mw(h.adjusted)}</td>
                <td>{mw(h.p90)}</td>
                <td>{mw(h.actual)}</td>
                <td>{signedPower(h.error)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Highlighted rows: outturn fell outside the 80% planning range. Positive error = forecast
        over-stated wind (shortfall to cover).
      </p>
    </div>
  )
}
