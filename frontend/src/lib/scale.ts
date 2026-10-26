// "Nice" axis ticks (1 / 2 / 2.5 / 5 × 10^n steps) that always include zero.

const STEP_MULTIPLIERS = [1, 2, 2.5, 5, 10]

export interface AxisScale {
  domain: [number, number]
  ticks: number[]
}

export function niceScale(values: Array<number | null | undefined>, target = 5): AxisScale {
  const finite = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const lo = Math.min(0, ...finite)
  const hi = Math.max(0, ...finite)
  const span = hi - lo || 1
  const top = lo + span
  const raw = span / target
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = (STEP_MULTIPLIERS.find((m) => m * magnitude >= raw) ?? 10) * magnitude
  const start = Math.floor(lo / step) * step
  const end = Math.ceil(top / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return { domain: [start, end], ticks }
}
