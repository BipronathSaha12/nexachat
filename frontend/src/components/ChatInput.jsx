import { useEffect, useRef, useState } from 'react'

import { SendIcon, StopIcon } from './icons'

const MAX_CHARS = 32000 // matches ChatRequestSerializer on the server

export default function ChatInput({ onSend, onStop, isBusy, disabled }) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef(null)

  // Grow with the content, but stop before the composer eats the transcript.
  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`
  }, [value])

  function submit(event) {
    event?.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || isBusy || disabled) return
    onSend(trimmed)
    setValue('')
  }

  function onKeyDown(event) {
    // Enter sends; Shift+Enter is a newline. IME composition must not submit.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      submit(event)
    }
  }

  const overLimit = value.length > MAX_CHARS
  const canSend = Boolean(value.trim()) && !disabled && !overLimit

  return (
    <div className="border-t border-line bg-canvas/85 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="mx-auto w-full max-w-3xl px-4 pt-3 pb-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        {/* One bordered surface holding the field and the action, so the
            composer reads as a single control rather than an input next to a
            detached button. */}
        <div
          className={`flex items-end gap-2 rounded-2xl border bg-surface py-2 pr-2 pl-3 transition-shadow ${
            focused ? 'border-accent shadow-lift' : 'border-line hover:border-line-strong'
          } ${overLimit ? 'border-danger' : ''}`}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Ask anything…"
            aria-label="Message"
            className="max-h-[200px] min-h-[32px] flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-6 text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
          />

          {isBusy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              title="Stop generating"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line text-ink-muted transition hover:bg-raised hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <StopIcon />
              <span className="sr-only">Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              title="Send"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink transition enabled:hover:bg-accent-hover disabled:bg-sunken disabled:text-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <SendIcon />
              <span className="sr-only">Send</span>
            </button>
          )}
        </div>

        <div className="mt-2 flex min-h-4 items-center justify-between px-1 text-[11px] text-ink-muted">
          {/* The keyboard hint is meaningless on a touch keyboard. */}
          <span className="hidden sm:inline">
            <kbd className="font-sans">Enter</kbd> to send ·{' '}
            <kbd className="font-sans">Shift</kbd>+<kbd className="font-sans">Enter</kbd> for a new line
          </span>
          <span className="sm:hidden" />
          {value.length > MAX_CHARS * 0.8 && (
            <span className={`tabular ${overLimit ? 'text-danger' : ''}`}>
              {value.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
