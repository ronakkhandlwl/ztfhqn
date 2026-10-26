import type { TooltipContentProps, TooltipValueType } from 'recharts'
import type { ReactNode } from 'react'

export interface TooltipRow {
  label: string
  value: string
  color?: string
}

export function TooltipBox({ title, rows }: { title: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="tooltip" role="status">
      <div className="tooltip__title">{title}</div>
      {rows.map((r) => (
        <div className="tooltip__row" key={r.label}>
          <span>
            {r.color && <span className="swatch" style={{ background: r.color }} aria-hidden />}
            {r.label}
          </span>
          <span>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Props Recharts passes to a custom tooltip `content` renderer. */
export type ChartTooltipProps = TooltipContentProps<TooltipValueType, string | number>
