import { SparkIcon } from './icons'

/** Shared frame for sign-in and registration, so the two never drift apart. */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <SparkIcon width={18} height={18} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink">AI Chatbot</span>
        </div>

        <h1 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}

        {children}

        {footer && <div className="mt-6 text-sm text-ink-muted">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ id, label, hint, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>
      )}
    </div>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[14.5px] text-ink transition placeholder:text-ink-faint hover:border-line-strong focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30'

export const submitClass =
  'w-full rounded-xl bg-accent px-3 py-2.5 text-[14px] font-medium text-accent-ink transition hover:bg-accent-hover disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
