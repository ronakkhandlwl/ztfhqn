// Chart colours are CSS custom properties (see index.css) so light/dark themes swap in one place.
// Roles follow the categorical order: forecast = slot 1, outturn = slot 2, bias-adjusted = slot 3.
export const COLORS = {
  forecast: 'var(--series-1)',
  actual: 'var(--series-2)',
  adjusted: 'var(--series-3)',
  band: 'var(--series-1)',
  vintage: 'var(--vintage)',
  vintageLate: 'var(--vintage-late)',
  over: 'var(--div-warm)',
  under: 'var(--div-cool)',
  grid: 'var(--grid)',
  axis: 'var(--axis)',
  muted: 'var(--text-muted)',
} as const

export const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: 12 }
