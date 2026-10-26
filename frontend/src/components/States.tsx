import { ApiError } from '../api/client'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid" aria-busy="true" aria-label={label}>
      <div className="skeleton" style={{ minHeight: 88 }} />
      <div className="skeleton" style={{ minHeight: 360 }} />
    </div>
  )
}

export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError || error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <div className="card state state--error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="icon-btn" style={{ width: 'auto', padding: '0 14px', marginTop: 12 }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
