// Pure derivations for the accuracy page: headline insights computed from the API payload.
import type { Accuracy, BucketStats, MarketComparison } from '../../api/types'

export interface Insight {
  headline: string
  detail: string
}

export function weightedBias(buckets: BucketStats[]): number | null {
  const n = buckets.reduce((acc, b) => acc + b.stats.n, 0)
  if (n === 0) return null
  return buckets.reduce((acc, b) => acc + b.stats.bias * b.stats.n, 0) / n
}

export function bestMarket(rows: MarketComparison[]): MarketComparison | null {
  return rows.reduce<MarketComparison | null>(
    (best, r) => (best === null || r.stats.mae < best.stats.mae ? r : best),
    null,
  )
}

export function maeReduction(a: Accuracy): number | null {
  if (!a.overall || !a.overallAdjusted || a.overall.mae === 0) return null
  return 1 - a.overallAdjusted.mae / a.overall.mae
}

export const HIGH_WIND_MW = 16_000

export function highWindBias(a: Accuracy): number | null {
  return weightedBias(a.byForecastLevel.filter((b) => b.key >= HIGH_WIND_MW))
}

export function lowWindBias(a: Accuracy): number | null {
  return weightedBias(a.byForecastLevel.filter((b) => b.key < HIGH_WIND_MW))
}
