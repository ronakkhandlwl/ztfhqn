export interface LegendEntry {
  label: string
  color: string
  kind?: 'line' | 'band' | 'dashed' | 'box'
}

export function Legend({ items }: { items: LegendEntry[] }) {
  return (
    <ul className="legend" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map((item) => (
        <li key={item.label} className="legend__item">
          <span
            aria-hidden
            className={`swatch ${item.kind === 'band' ? 'swatch--band' : item.kind === 'box' ? '' : 'swatch--line'}`}
            style={
              item.kind === 'dashed'
                ? {
                    background: `repeating-linear-gradient(90deg, ${item.color} 0 4px, transparent 4px 7px)`,
                  }
                : { background: item.color }
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
