// Pure transforms from the decision API payload into chart rows and narrative text.
import type { Decision } from '../../api/types'
import { energy, minutesToText, pctChange, signedPower } from '../../lib/format'
import { formatDate, formatDayTime, formatTime, toMs } from '../../lib/time'

export interface DecisionRow {
  t: number
  forecast?: number
  adjusted?: number
  band?: [number, number]
  actual?: number
}

export function buildDecisionRows(d: Decision, includeActual: boolean): DecisionRow[] {
  const rows = new Map<number, DecisionRow>()
  const row = (t: number) => {
    const existing = rows.get(t)
    if (existing) return existing
    const created: DecisionRow = { t }
    rows.set(t, created)
    return created
  }
  for (const h of d.hours) {
    const r = row(toMs(h.startTime))
    r.forecast = h.forecast
    if (h.adjusted !== null) r.adjusted = h.adjusted
    if (h.p10 !== null && h.p90 !== null) r.band = [h.p10, h.p90]
  }
  if (includeActual) {
    for (const a of d.actualsHalfHourly) row(toMs(a.startTime)).actual = a.generation
  }
  return [...rows.values()].sort((a, b) => a.t - b.t)
}

export interface EvolutionSeries {
  key: string
  publishTime: string
  role: 'earlier' | 'decision' | 'later'
}

export function buildEvolution(d: Decision): {
  rows: Array<Record<string, number>>
  series: EvolutionSeries[]
} {
  const rows = new Map<number, Record<string, number>>()
  const series: EvolutionSeries[] = d.vintages.map((v, i) => ({
    key: `v${i}`,
    publishTime: v.publishTime,
    role: v.isDecision ? 'decision' : v.afterCutoff ? 'later' : 'earlier',
  }))
  d.vintages.forEach((v, i) => {
    for (const p of v.points) {
      const t = toMs(p.startTime)
      const r = rows.get(t) ?? { t }
      r[`v${i}`] = p.generation
      rows.set(t, r)
    }
  })
  for (const a of d.actualsHalfHourly) {
    const t = toMs(a.startTime)
    const r = rows.get(t) ?? { t }
    r.actual = a.generation
    rows.set(t, r)
  }
  return { rows: [...rows.values()].sort((a, b) => a.t - b.t), series }
}

export function outsideBandHours(d: Decision): { below: number; above: number; total: number } {
  let below = 0
  let above = 0
  let total = 0
  for (const h of d.hours) {
    if (h.actual === null || h.p10 === null || h.p90 === null) continue
    total += 1
    if (h.actual < h.p10) below += 1
    else if (h.actual > h.p90) above += 1
  }
  return { below, above, total }
}

export function decisionStory(d: Decision): string {
  const s = d.summary
  if (!s || !d.forecastPublishTime) {
    return 'No forecast had been published before the bid cutoff for this delivery day.'
  }
  const base =
    `Bids for ${d.market.name} closed at ${formatTime(d.gateClosure)} on ${formatDate(d.decisionDate)}. ` +
    `The latest wind forecast when bids were finalised (${formatTime(d.cutoff)}) was published at ` +
    `${formatTime(d.forecastPublishTime)} — ${minutesToText(d.forecastAgeMinutes)} earlier — and expected ` +
    `${energy(s.forecastEnergyMwh)} of wind over the delivery day.`
  if (!d.band || s.adjustedEnergyMwh === null) return base
  const bias = d.band.q50
  const direction = bias >= 0 ? 'high' : 'low'
  return (
    `${base} Over the previous ${d.band.windowDays} days this forecast ran ` +
    `${signedPower(bias).replace(/^[+−]/, '')} ${direction} per hour (median), so plan on ` +
    `${energy(s.adjustedEnergyMwh)} (${pctChange(s.forecastEnergyMwh, s.adjustedEnergyMwh)} vs raw), ` +
    `with an 80% range of ${energy(s.lowEnergyMwh)} – ${energy(s.highEnergyMwh)}.`
  )
}

export function hindsightStory(d: Decision): string | null {
  const s = d.summary
  if (!s || s.actualEnergyMwh === null || !s.stats) return null
  const { below, above, total } = outsideBandHours(d)
  const vsForecast = pctChange(s.forecastEnergyMwh, s.actualEnergyMwh)
  const bandText =
    total === 0
      ? ''
      : below + above === 0
        ? ` Every hour landed inside the 80% planning range.`
        : ` ${below} of ${total} hours fell below the low case and ${above} above the high case.`
  return (
    `Hindsight: metered wind delivered ${energy(s.actualEnergyMwh)} (${vsForecast} vs the bid-time forecast), ` +
    `a mean absolute error of ${signedPower(s.stats.mae).replace('+', '')} per hour.${bandText}`
  )
}

export function vintageLabel(publishTime: string): string {
  return formatDayTime(publishTime)
}
