/** Shown between sending and the first token, which is a real few seconds. */
export default function LoadingIndicator({ label = 'Thinking' }) {
  return (
    <div className="flex items-center gap-2 py-1" role="status" aria-live="polite">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1.5 animate-shimmer rounded-full bg-ink-faint"
            style={{ animationDelay: `${index * 0.16}s` }}
          />
        ))}
      </span>
      <span className="text-sm text-ink-muted">{label}</span>
    </div>
  )
}
