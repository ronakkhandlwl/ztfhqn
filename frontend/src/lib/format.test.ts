import { describe, expect, it } from 'vitest'
import {
  DASH,
  energy,
  gwTick,
  hours,
  minutesToText,
  mw,
  pct,
  pctChange,
  power,
  signedGw,
  signedPower,
} from './format'

describe('format', () => {
  it('formats power in MW and GW', () => {
    expect(mw(12345.6)).toBe('12,346 MW')
    expect(power(12345)).toBe('12.3 GW')
    expect(power(820)).toBe('820 MW')
    expect(power(-1500)).toBe('-1.5 GW')
  })

  it('signs errors with a typographic minus', () => {
    expect(signedPower(1747)).toBe('+1.7 GW')
    expect(signedPower(-417)).toBe('−417 MW')
    expect(signedPower(0)).toBe('0 MW')
    expect(signedGw(-417)).toBe('−0.4 GW')
    expect(signedGw(4100)).toBe('+4.1 GW')
  })

  it('formats energy, ratios and durations', () => {
    expect(energy(467926)).toBe('467.9 GWh')
    expect(energy(900)).toBe('900 MWh')
    expect(pct(0.1786)).toBe('17.9%')
    expect(pct(0.85, 0)).toBe('85%')
    expect(pct(0.12345, 2)).toBe('12.35%')
    expect(pctChange(100, 75)).toBe('−25.0%')
    expect(pctChange(100, 110)).toBe('+10.0%')
    expect(pctChange(0, 10)).toBe(DASH)
    expect(hours(15.5)).toBe('15.5 h')
    expect(minutesToText(80)).toBe('1 h 20 min')
    expect(minutesToText(45)).toBe('45 min')
    expect(minutesToText(120)).toBe('2 h')
  })

  it('formats axis ticks', () => {
    expect(gwTick(0)).toBe('0')
    expect(gwTick(5000)).toBe('5 GW')
    expect(gwTick(2500)).toBe('2.5 GW')
  })

  it('returns a dash for missing values', () => {
    for (const fn of [mw, power, signedPower, signedGw, energy, pct, hours, minutesToText]) {
      expect(fn(null)).toBe(DASH)
      expect(fn(undefined)).toBe(DASH)
      expect(fn(Number.NaN)).toBe(DASH)
    }
  })
})
