import type { ReactNode } from 'react'

interface CardProps {
  title: string
  subtitle?: ReactNode
  aside?: ReactNode
  children: ReactNode
}

export function Card({ title, subtitle, aside, children }: CardProps) {
  return (
    <section className="card" aria-label={title}>
      <div className="card__head">
        <div>
          <h2 className="card__title">{title}</h2>
          {subtitle && <p className="card__subtitle">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}
