import type { ReactNode } from 'react'

interface TileProps {
  label: string
  value: string
  note?: ReactNode
  swatch?: string
  accent?: boolean
}

export function Tile({ label, value, note, swatch, accent }: TileProps) {
  return (
    <div className={`tile${accent ? ' tile--accent' : ''}`}>
      <span className="tile__label">
        {swatch && <span className="swatch" style={{ background: swatch }} aria-hidden />}
        {label}
      </span>
      <span className="tile__value">{value}</span>
      {note && <span className="tile__note">{note}</span>}
    </div>
  )
}
