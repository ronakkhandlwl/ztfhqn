import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useMeta } from '../api/queries'
import { formatDateShort } from '../lib/time'

const NAV = [
  { to: '/', label: 'Decision desk', end: true },
  { to: '/accuracy', label: 'Forecast accuracy' },
  { to: '/explorer', label: 'Horizon explorer' },
  { to: '/methodology', label: 'Methodology' },
]

function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 12V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L4 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    </svg>
  )
}

export function Layout() {
  const { data: meta } = useMeta()
  const { search } = useLocation()
  // Keep market / lead selections when moving between views.
  const keep = new URLSearchParams(search)
  keep.delete('date')
  const carry = keep.toString() ? `?${keep.toString()}` : ''

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <NavLink to={`/${carry}`} className="brand">
            <span className="brand__mark">
              <Logo />
            </span>
            <span>
              <div className="brand__name">Wind Desk</div>
              <div className="brand__sub">GB day-ahead wind forecasts</div>
            </span>
          </NavLink>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={`${n.to}${n.to === '/methodology' ? '' : carry}`} end={n.end}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          {meta && (
            <div className="header-meta">
              Decisions {formatDateShort(meta.decisionStart)} – {formatDateShort(meta.decisionEnd)}{' '}
              2026
              <br />
              Source: Elexon BMRS · FUELHH &amp; WINDFOR
            </div>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="app-footer">
        Pilot build · Data: Elexon BMRS Insights API (FUELHH wind outturn, WINDFOR national wind
        forecast). Times shown in UK local time.
      </footer>
    </>
  )
}
