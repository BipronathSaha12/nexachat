import { memo, useEffect, useState } from 'react'

import { CheckIcon, CopyIcon } from './icons'
import LoadingIndicator from './LoadingIndicator'
import Markdown from './Markdown'

function CopyAnswer({ text }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false) // clipboard blocked (insecure context or denied)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Answer copied' : 'Copy answer'}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-faint transition hover:bg-raised hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function Message({ message }) {
  if (message.role === 'user') {
    return (
      <div className="animate-rise flex justify-end px-4 py-3">
        {/* Tinted rather than a saturated slab: the user's own words do not
            need to be the loudest thing on the page. */}
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-line bg-raised px-4 py-2.5">
          {/* Plain text, never Markdown -- this is what the user typed. */}
          <p className="text-[15px] leading-7 whitespace-pre-wrap text-ink">{message.content}</p>
        </div>
      </div>
    )
  }

  const empty = !message.content

  return (
    <div className="group animate-rise px-4 py-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">
          Assistant
        </span>
        {message.failed && (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-danger">
            incomplete
          </span>
        )}
      </div>

      {empty && message.streaming ? (
        <LoadingIndicator />
      ) : (
        <>
          <Markdown>{message.content}</Markdown>
          {message.streaming && (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-[1.15em] w-[2px] animate-caret rounded-full bg-accent align-text-bottom"
            />
          )}
        </>
      )}

      {message.stopped && <p className="mt-1.5 text-xs text-ink-faint">Stopped.</p>}

      {/* Actions stay hidden until hover so the transcript reads cleanly, but
          remain reachable by keyboard. */}
      {!message.streaming && message.content && (
        <div className="mt-1.5 -ml-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <CopyAnswer text={message.content} />
          {message.usage?.output_tokens != null && (
            <span className="tabular px-1 text-[11px] text-ink-faint">
              {message.usage.output_tokens} tokens
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(Message)
