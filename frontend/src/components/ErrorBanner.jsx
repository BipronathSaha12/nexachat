/** Every failure the user sees goes through here, so the wording stays consistent. */
export default function ErrorBanner({ error, onRetry, onDismiss }) {
  if (!error) return null

  const retryable = [
    'upstream_error',
    'upstream_timeout',
    'upstream_rate_limited',
    'network_error',
    'stream_interrupted',
    'database_error',
    'internal_error',
  ].includes(error.code)

  return (
    <div
      role="alert"
      className="animate-rise my-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-danger">{error.message}</p>
          {error.requestId && (
            // Surfacing the id lets a user quote it in a bug report; it is the same
            // id the server logged the failure under.
            <p className="mt-1 font-mono text-[11px] text-ink-faint">Ref {error.requestId}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {retryable && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss error"
              className="rounded-lg px-2 py-1 text-xs text-ink-faint transition hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
