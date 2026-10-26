import { describe, expect, it } from 'vitest'
import { decision } from '../../test/fixtures'
import {
  buildDecisionRows,
  buildEvolution,
  decisionStory,
  hindsightStory,
  outsideBandHours,
} from './decisionModel'

describe('decisionModel', () => {
  it('merges hourly forecast and half-hourly outturn by time', () => {
    const rows = buildDecisionRows(decision(), true)
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({ forecast: 10000, adjusted: 9000, band: [7000, 10500], actual: 6000 })
    expect(rows[1]).toEqual({ t: Date.parse('2026-01-02T23:30:00Z'), actual: 6100 })
    expect(rows[3].band).toBeUndefined()
  })

  it('can hide outturn', () => {
    const rows = buildDecisionRows(decision(), false)
    expect(rows.every((r) => r.actual === undefined)).toBe(true)
  })

  it('labels vintages by role', () => {
    const { series, rows } = buildEvolution(decision())
    expect(series.map((s) => s.role)).toEqual(['earlier', 'decision', 'later'])
    expect(rows[0]).toMatchObject({ v0: 10200, v1: 10000, v2: 9500, actual: 6000 })
  })

  it('counts hours outside the planning range', () => {
    expect(outsideBandHours(decision())).toEqual({ below: 1, above: 0, total: 2 })
  })

  it('writes the decision and hindsight narrative', () => {
    const story = decisionStory(decision())
    expect(story).toContain('09:20')
    expect(story).toContain('07:30')
    expect(story).toContain('30.0 GWh')
    expect(story).toContain('1.0 GW high')
    expect(hindsightStory(decision())).toContain('1 of 2 hours fell below')
  })

  it('handles missing forecast, band and outturn', () => {
    expect(decisionStory(decision({ forecastPublishTime: null }))).toMatch(/No forecast/)
    expect(decisionStory(decision({ band: null }))).not.toContain('plan on')
    const noActual = decision()
    noActual.summary = { ...noActual.summary!, actualEnergyMwh: null }
    expect(hindsightStory(noActual)).toBeNull()
  })
})
