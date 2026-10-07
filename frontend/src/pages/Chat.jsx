import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { getConversation } from '../api/conversations'
import ChatInput from '../components/ChatInput'
import ChatWindow from '../components/ChatWindow'
import ErrorBanner from '../components/ErrorBanner'
import Sidebar from '../components/Sidebar'
import { MenuIcon } from '../components/icons'
import { useChat } from '../hooks/useChat'
import { useConversations } from '../hooks/useConversations'

export default function Chat() {
  const { conversationId } = useParams()
  const navigate = useNavigate()

  const { conversations, loading, refresh, upsert, setTitle, rename, remove } = useConversations()

  const [history, setHistory] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const justCreatedRef = useRef(null)

  // Load the selected conversation's history (PRD 5.2, 5.5).
  useEffect(() => {
    if (!conversationId) {
      setHistory([])
      setLoadError(null)
      return undefined
    }
    if (justCreatedRef.current === conversationId) {
      justCreatedRef.current = null
      return undefined
    }
    const controller = new AbortController()
    setLoadError(null)
    getConversation(conversationId, { signal: controller.signal })
      .then((conversation) => setHistory(conversation.messages ?? []))
      .catch((error) => {
        if (error.name === 'AbortError') return
        // A deleted or foreign id returns 404; fall back to a new conversation.
        if (error.status === 404) navigate('/', { replace: true })
        else setLoadError(error)
      })
    return () => controller.abort()
  }, [conversationId, navigate])

  const onConversationCreated = useCallback(
    (id) => {
      // Adopt the server-assigned id without remounting: replace, do not push.
      justCreatedRef.current = id
      upsert({ id, title: 'New conversation', message_count: 0 })
      navigate(`/c/${id}`, { replace: true })
    },
    [navigate, upsert],
  )

  const onTitle = useCallback((id, title) => setTitle(id, title), [setTitle])

  const { messages, error, send, stop, retry, isBusy, clearError } = useChat({
    conversationId,
    initialMessages: history,
    onConversationCreated,
    onTitle,
  })

  const onDelete = useCallback(
    async (id) => {
      try {
        await remove(id)
        if (id === conversationId) navigate('/', { replace: true })
      } catch {
        refresh() // rollback already happened; resync with the server
      }
    },
    [remove, conversationId, navigate, refresh],
  )

  const onRename = useCallback(
    async (id, title) => {
      try {
        await rename(id, title)
      } catch {
        refresh()
      }
    },
    [rename, refresh],
  )

  return (
    <div className="flex h-full bg-canvas">
      <Sidebar
        conversations={conversations}
        activeId={conversationId}
        loading={loading}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNew={() => {
          navigate('/')
          setSidebarOpen(false)
        }}
        onSelect={(id) => {
          navigate(`/c/${id}`)
          setSidebarOpen(false)
        }}
        onRename={onRename}
        onDelete={onDelete}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-1.5 border-b border-line bg-surface px-2 py-2 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="flex size-9 items-center justify-center rounded-lg text-ink-muted transition hover:bg-raised hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MenuIcon />
          </button>
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
            {conversations.find((item) => item.id === conversationId)?.title ?? 'New conversation'}
          </span>
          <span className="size-9 shrink-0" aria-hidden="true" />
        </header>

        {loadError && (
          <div className="px-4 pt-3">
            <ErrorBanner error={loadError} onDismiss={() => setLoadError(null)} />
          </div>
        )}

        <ChatWindow
          key={conversationId ?? 'new'}
          messages={messages}
          error={error}
          onRetry={retry}
          onDismissError={clearError}
          onPickSuggestion={send}
        />

        <ChatInput onSend={send} onStop={stop} isBusy={isBusy} />
      </main>
    </div>
  )
}
