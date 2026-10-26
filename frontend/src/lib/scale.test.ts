import { describe, expect, it } from 'vitest'
import { niceScale } from './scale'

describe('niceScale', () => {
  it('produces round GW steps from zero', () => {
    expect(niceScale([3000, 21800])).toEqual({ domain: [0, 25000], ticks: [0, 5000, 10000, 15000, 20000, 25000] })
  })

  it('spans negative values', () => {
    const s = niceScale([-1800, 4600], 4)
    expect(s.ticks[0]).toBeLessThanOrEqual(-1800)
    expect(s.ticks.at(-1)).toBeGreaterThanOrEqual(4600)
    expect(s.ticks).toContain(0)
  })

  it('ignores missing values and handles empty input', () => {
    expect(niceScale([null, undefined, Number.NaN]).domain).toEqual([0, 1])
  })
})
