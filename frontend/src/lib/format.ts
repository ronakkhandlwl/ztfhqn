// Number formatting for power (MW), energy (MWh) and ratios. Pure functions, unit-tested.

const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const DASH = '—'

function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 12345 -> "12,345 MW" */
export function mw(v: number | null | undefined): string {
  return isNum(v) ? `${nf0.format(v)} MW` : DASH
}

/** 12345 -> "12.3 GW"; switches to MW below 1 GW. */
export function power(v: number | null | undefined): string {
  if (!isNum(v)) return DASH
  return Math.abs(v) >= 1000 ? `${nf1.format(v / 1000)} GW` : `${nf0.format(v)} MW`
}

/** Signed power for errors: "+1.7 GW" / "−820 MW". */
export function signedPower(v: number | null | undefined): string {
  if (!isNum(v)) return DASH
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${power(Math.abs(v))}`
}

/** Signed power always in GW with one decimal: "−0.4 GW". */
export function signedGw(v: number | null | undefined): string {
  if (!isNum(v)) return DASH
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${nf1.format(Math.abs(v) / 1000)} GW`
}

/** Energy from MWh -> "467.9 GWh" (or MWh when small). */
export function energy(mwh: number | null | undefined): string {
  if (!isNum(mwh)) return DASH
  return Math.abs(mwh) >= 1000 ? `${nf1.format(mwh / 1000)} GWh` : `${nf0.format(mwh)} MWh`
}

/** 0.1234 -> "12.3%" */
export function pct(v: number | null | undefined, digits = 1): string {
  if (!isNum(v)) return DASH
  return `${(digits === 0 ? nf0 : digits === 2 ? nf2 : nf1).format(v * 100)}%`
}

/** Relative change a -> b as a signed percentage string. */
export function pctChange(from: number | null | undefined, to: number | null | undefined): string {
  if (!isNum(from) || !isNum(to) || from === 0) return DASH
  const change = (to - from) / Math.abs(from)
  const sign = change > 0 ? '+' : change < 0 ? '−' : ''
  return `${sign}${nf1.format(Math.abs(change) * 100)}%`
}

/** Axis ticks: 12000 -> "12 GW", 500 -> "0.5 GW". */
export function gwTick(v: number): string {
  if (v === 0) return '0'
  const gw = v / 1000
  return `${Number.isInteger(gw) ? gw : gw.toFixed(1)} GW`
}

export function hours(v: number | null | undefined): string {
  return isNum(v) ? `${nf1.format(v)} h` : DASH
}

export function minutesToText(v: number | null | undefined): string {
  if (!isNum(v)) return DASH
  const h = Math.floor(v / 60)
  const m = Math.round(v % 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
