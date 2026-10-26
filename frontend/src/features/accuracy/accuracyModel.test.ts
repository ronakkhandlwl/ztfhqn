import { describe, expect, it } from 'vitest'
import { accuracy } from '../../test/fixtures'
import { bestMarket, highWindBias, lowWindBias, maeReduction, weightedBias } from './accuracyModel'

describe('accuracyModel', () => {
  it('computes MAE reduction from bias adjustment', () => {
    expect(maeReduction(accuracy)).toBeCloseTo(1 - 1445 / 2019)
    expect(maeReduction({ ...accuracy, overallAdjusted: null })).toBeNull()
  })

  it('weights bias by sample count', () => {
    expect(weightedBias(accuracy.byForecastLevel)).toBeCloseTo((1000 * 30 + 2000 * 10 + 4000 * 10) / 50)
    expect(weightedBias([])).toBeNull()
    expect(highWindBias(accuracy)).toBe(3000)
    expect(lowWindBias(accuracy)).toBe(1000)
  })

  it('finds the auction with the lowest error', () => {
    expect(bestMarket(accuracy.marketComparison)?.market.id).toBe('epex-half-hourly')
    expect(bestMarket([])).toBeNull()
  })
})
