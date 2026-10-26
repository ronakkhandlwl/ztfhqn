// Merge half-hourly outturn and hourly forecasts into one time-keyed series for charting.
import type { Explorer } from '../../api/types'
import { toMs } from '../../lib/time'

export interface ExplorerRow {
  t: number
  actual?: number
  forecast?: number
  publishTime?: string
  horizonH?: number
}

export function buildExplorerRows(data: Explorer): ExplorerRow[] {
  const rows = new Map<number, ExplorerRow>()
  for (const a of data.actuals) rows.set(toMs(a.startTime), { t: toMs(a.startTime), actual: a.generation })
  for (const f of data.forecasts) {
    const t = toMs(f.startTime)
    rows.set(t, {
      ...(rows.get(t) ?? { t }),
      forecast: f.generation,
      publishTime: f.publishTime,
      horizonH: f.horizonH,
    })
  }
  return [...rows.values()].sort((a, b) => a.t - b.t)
}
