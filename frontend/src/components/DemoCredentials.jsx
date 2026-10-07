/**
 * Published demo credentials with one-click sign-in.
 *
 * Renders only when VITE_DEMO_EMAIL and VITE_DEMO_PASSWORD are set, so a private
 * deployment simply omits them and the panel disappears.
 */

/** Read at call time, not module load, so the panel reflects the current config. */
export function getDemoCredentials() {
  const email = import.meta.env.VITE_DEMO_EMAIL ?? ''
  const password = import.meta.env.VITE_DEMO_PASSWORD ?? ''
  return email && password ? { email, password } : null
}

export default function DemoCredentials({ onUse, disabled }) {
  const credentials = getDemoCredentials()
  if (!credentials) return null

  return (
    <div className="rounded-xl border border-line bg-raised p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-ink">Try it without signing up</p>
          <dl className="mt-1.5 space-y-0.5 font-mono text-[11px] text-ink-muted">
            <div className="flex gap-2">
              <dt className="w-9 shrink-0 text-ink-faint">email</dt>
              <dd className="truncate select-all">{credentials.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-9 shrink-0 text-ink-faint">pass</dt>
              <dd className="truncate select-all">{credentials.password}</dd>
            </div>
          </dl>
        </div>
        <button
          type="button"
          onClick={() => onUse(credentials)}
          disabled={disabled}
          className="shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent hover:text-accent disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Use demo
        </button>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">
        Shared account — anyone can see these conversations.
      </p>
    </div>
  )
}
