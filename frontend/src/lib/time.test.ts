import { describe, expect, it } from 'vitest'
import { addDays, formatDate, formatDateShort, formatDayTime, formatTime } from './time'

describe('time', () => {
  it('formats in UK local time across BST', () => {
    expect(formatTime('2026-01-14T09:20:00Z')).toBe('09:20')
    expect(formatTime('2026-07-14T08:20:00Z')).toBe('09:20')
  })

  it('formats calendar dates without timezone drift', () => {
    expect(formatDate('2026-01-15')).toBe('Thu 15 Jan')
    expect(formatDateShort('2026-02-01')).toBe('1 Feb')
    expect(formatDayTime('2026-01-11T07:30:00Z')).toBe('Sun 11 Jan, 07:30')
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
})
