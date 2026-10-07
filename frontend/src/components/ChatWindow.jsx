import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import ErrorBanner from './ErrorBanner'
import Message from './Message'
import { ArrowDownIcon } from './icons'

const STICK_THRESHOLD_PX = 80

// Concrete starting points beat a blank page. These are things the app is
// actually good at, not decoration.
const SUGGESTIONS = [
  'Explain Python decorators with a short example',
  'Write a SQL query for the top 5 customers by revenue',
  'Why does useEffect run twice in React StrictMode?',
  'Compare REST and GraphQL in a table',
]

function EmptyState({ onPick }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-end px-4 pb-6">
      <div className="animate-rise">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          What can I help you with?
        </h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          Answers stream as they are written. Code arrives highlighted and ready to copy.
        </p>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((text) => (
            <li key={text}>
              <button
                type="button"
                onClick={() => onPick?.(text)}
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-left text-[13.5px] leading-5 text-ink-muted transition hover:border-line-strong hover:bg-raised hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function ChatWindow({ messages, error, onRetry, onDismissError, onPickSuggestion }) {
  const scrollRef = useRef(null)
  const [stick, setStick] = useState(true)

  const atBottom = useCallback(() => {
    const element = scrollRef.current
    if (!element) return true
    return element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD_PX
  }, [])

  // Reading back through the transcript must not be yanked away by new tokens,
  // so auto-scroll only continues while the user is already at the bottom.
  const onScroll = useCallback(() => setStick(atBottom()), [atBottom])

  useLayoutEffect(() => {
    if (!stick) return
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, stick])

  const empty = messages.length === 0 && !error

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto overscroll-contain"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {empty ? (
          <EmptyState onPick={onPickSuggestion} />
        ) : (
          <div className="mx-auto max-w-3xl py-6">
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            <div className="px-4">
              <ErrorBanner error={error} onRetry={onRetry} onDismiss={onDismissError} />
            </div>
          </div>
        )}
      </div>

      {!stick && messages.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setStick(true)
            const element = scrollRef.current
            if (element) element.scrollTop = element.scrollHeight
          }}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted shadow-lift transition hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ArrowDownIcon width={13} height={13} />
          Jump to latest
        </button>
      )}
    </div>
  )
}
