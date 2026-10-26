// All times are shown in GB local time (Europe/London), the market's clock.

export const UK_TZ = 'Europe/London'

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const dayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const dayTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const shortDayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TZ,
  day: 'numeric',
  month: 'short',
})

export const toMs = (iso: string): number => Date.parse(iso)

export const formatTime = (v: string | number): string => timeFmt.format(new Date(v))
export const formatDayTime = (v: string | number): string => dayTimeFmt.format(new Date(v))
export const formatShortDay = (v: string | number): string => shortDayFmt.format(new Date(v))

/** A calendar date ("2026-01-15") rendered without timezone drift. */
export function formatDate(isoDate: string): string {
  return dayFmt.format(new Date(`${isoDate}T12:00:00Z`))
}

export function formatDateShort(isoDate: string): string {
  return shortDayFmt.format(new Date(`${isoDate}T12:00:00Z`))
}

/** Add whole days to a calendar date string. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
