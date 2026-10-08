import { useEffect, useMemo, useRef, useState } from 'react'

import { PencilIcon, TrashIcon } from './icons'

/** Group by recency the way people actually remember conversations. */
function groupByAge(conversations) {
  const now = Date.now()
  const day = 86400000
  const buckets = new Map([
    ['Today', []],
    ['Yesterday', []],
    ['Previous 7 days', []],
    ['Older', []],
  ])

  for (const conversation of conversations) {
    const stamp = Date.parse(conversation.updated_at ?? conversation.created_at ?? '')
    const age = Number.isNaN(stamp) ? Infinity : now - stamp
    const key =
      age < day ? 'Today' : age < 2 * day ? 'Yesterday' : age < 7 * day ? 'Previous 7 days' : 'Older'
    buckets.get(key).push(conversation)
  }

  return [...buckets].filter(([, items]) => items.length > 0)
}

function ConversationItem({ conversation, active, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conversation.title)
  const [confirming, setConfirming] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function startEditing() {
    setDraft(conversation.title) // seed from the current title, not a stale draft
    setEditing(true)
  }

  function commit() {
    const title = draft.trim()
    setEditing(false)
    if (title && title !== conversation.title) onRename(conversation.id, title)
    else setDraft(conversation.title)
  }

  if (editing) {
    return (
      <li>
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
              setDraft(conversation.title)
              setEditing(false)
            }
          }}
          aria-label="Conversation title"
          className="w-full rounded-lg border border-accent bg-surface px-2.5 py-2 text-[13px] text-ink focus:outline-none"
        />
      </li>
    )
  }

  return (
    <li className="group/item relative">
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        aria-current={active ? 'page' : undefined}
        // The message count is decorative; the title alone is the accessible name.
        aria-label={conversation.title}
        className={`flex w-full items-center gap-2 rounded-lg py-2 pr-2 pl-2.5 text-left text-[13px] transition ${
          active
            ? 'bg-raised font-medium text-ink'
            : 'text-ink-muted hover:bg-raised/70 hover:text-ink'
        } focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
      >
        {/* A quiet marker for the active thread, instead of relying on fill alone. */}
        <span
          aria-hidden="true"
          className={`h-4 w-0.5 shrink-0 rounded-full transition ${active ? 'bg-accent' : 'bg-transparent'}`}
        />
        <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
      </button>

      {/* Icon actions, revealed on hover/focus so rows stay legible. */}
      <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 rounded-r-lg bg-gradient-to-l from-raised via-raised to-transparent pr-1 pl-5 opacity-0 transition group-hover/item:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={startEditing}
          aria-label={`Rename ${conversation.title}`}
          title="Rename"
          className="flex size-7 items-center justify-center rounded-md text-ink-faint transition hover:bg-sunken hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <PencilIcon width={14} height={14} />
        </button>
        <button
          type="button"
          onClick={() => (confirming ? onDelete(conversation.id) : setConfirming(true))}
          onBlur={() => setConfirming(false)}
          aria-label={confirming ? `Confirm delete ${conversation.title}` : `Delete ${conversation.title}`}
          title={confirming ? 'Click again to delete' : 'Delete'}
          className={`flex h-7 items-center justify-center rounded-md px-1.5 text-[11px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            confirming
              ? 'bg-danger text-white'
              : 'w-7 text-ink-faint hover:bg-sunken hover:text-danger'
          }`}
        >
          {confirming ? 'Sure?' : <TrashIcon width={14} height={14} />}
        </button>
      </div>
    </li>
  )
}

export default function ConversationList({
  conversations,
  activeId,
  loading,
  onSelect,
  onRename,
  onDelete,
}) {
  const groups = useMemo(() => groupByAge(conversations ?? []), [conversations])

  if (loading) {
    return (
      <ul className="space-y-1 px-2" aria-busy="true">
        {[0, 1, 2, 3].map((index) => (
          <li key={index} className="h-9 animate-shimmer rounded-lg bg-raised" />
        ))}
      </ul>
    )
  }

  if (!conversations.length) {
    return (
      <p className="px-4 py-8 text-center text-[13px] text-ink-faint">
        No conversations yet.
      </p>
    )
  }

  return (
    <div className="space-y-4 px-2 pb-2">
      {groups.map(([label, items]) => (
        <div key={label}>
          <h2 className="px-2.5 pb-1 text-[11px] font-medium tracking-wide text-ink-muted uppercase">
            {label}
          </h2>
          <ul className="space-y-0.5">
            {items.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeId}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
