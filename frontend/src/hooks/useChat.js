import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { streamChat } from '../api/chat'

/**
 * Chat state machine (PRD 8).
 *
 *   idle -> sending -> streaming -> completed
 *                   \-> error
 *
 * `sending` covers the wait before the first token; `streaming` begins once text
 * arrives. The distinction is what lets the UI show a thinking indicator rather than
 * an empty bubble, which matters here: observed time-to-first-token is around 3s.
 */
export const Status = {
  IDLE: 'idle',
  SENDING: 'sending',
  STREAMING: 'streaming',
  COMPLETED: 'completed',
  ERROR: 'error',
}

let localId = 0
const nextLocalId = () => `local-${++localId}`

export function useChat({ conversationId, initialMessages = [], onConversationCreated, onTitle }) {
  const [messages, setMessages] = useState(initialMessages)
  const [status, setStatus] = useState(Status.IDLE)
  const [error, setError] = useState(null)

  const abortRef = useRef(null)
  const streamingIdRef = useRef(null)
  // Id this hook itself announced for a brand new conversation. The parent then
  // navigates to it, which changes `conversationId` -- but that is the same thread
  // we are already streaming into, so it must not trigger a reset.
  const adoptedIdRef = useRef(null)

  // Callbacks are read through a ref so a parent re-render cannot invalidate `send`
  // (and therefore restart an in-flight stream).
  const handlers = useRef({ onConversationCreated, onTitle })
  handlers.current = { onConversationCreated, onTitle }

  // History is fetched by the parent, so it arrives after mount. Keying on the
  // message ids -- rather than the array's identity, which a caller may recreate on
  // every render -- is what makes an existing conversation render its transcript
  // instead of opening blank, without looping.
  const historyKey = useMemo(() => initialMessages.map((message) => message.id).join('|'), [initialMessages])
  const historyRef = useRef(initialMessages)
  historyRef.current = initialMessages

  useEffect(() => {
    if (adoptedIdRef.current && adoptedIdRef.current === conversationId) {
      adoptedIdRef.current = null // we already own this thread's messages
      return
    }
    if (streamingIdRef.current) return // never clobber a reply that is still arriving
    setMessages(historyRef.current)
    setStatus(Status.IDLE)
    setError(null)
  }, [conversationId, historyKey])

  // Abort any in-flight stream when the component goes away.
  useEffect(() => () => abortRef.current?.abort(), [])

  const patchStreaming = useCallback((patch) => {
    const id = streamingIdRef.current
    if (!id) return
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, ...(typeof patch === 'function' ? patch(message) : patch) } : message,
      ),
    )
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    patchStreaming((message) => ({
      streaming: false,
      content: message.content,
      stopped: true,
    }))
    streamingIdRef.current = null
    setStatus(Status.COMPLETED)
  }, [patchStreaming])

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim()
      if (!trimmed || status === Status.SENDING || status === Status.STREAMING) return

      const controller = new AbortController()
      abortRef.current = controller

      const assistantId = nextLocalId()
      streamingIdRef.current = assistantId

      setError(null)
      setStatus(Status.SENDING)
      // The user's own message is shown immediately, before any network call (PRD 5.2).
      setMessages((current) => [
        ...current,
        { id: nextLocalId(), role: 'user', content: trimmed },
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ])

      try {
        await streamChat(
          { conversationId, message: trimmed, signal: controller.signal },
          {
            onMeta: (meta) => {
              if (!conversationId && meta.conversation_id) {
                adoptedIdRef.current = meta.conversation_id
                handlers.current.onConversationCreated?.(meta.conversation_id)
              }
            },
            onDelta: (chunk) => {
              setStatus(Status.STREAMING)
              patchStreaming((message) => ({ content: message.content + chunk }))
            },
            onDone: (done) => {
              patchStreaming({ streaming: false, id: done.message_id || assistantId, usage: done.usage })
              streamingIdRef.current = null
              setStatus(Status.COMPLETED)
              if (done.title) handlers.current.onTitle?.(done.conversation_id, done.title)
            },
            onError: (streamError) => {
              // Text already rendered stays on screen; the error is shown beneath it.
              patchStreaming({ streaming: false, failed: true })
              streamingIdRef.current = null
              setError(streamError)
              setStatus(Status.ERROR)
            },
          },
        )
      } catch (requestError) {
        if (requestError.name === 'AbortError') return
        // Failed before the stream opened: drop the empty placeholder bubble.
        setMessages((current) => current.filter((message) => message.id !== assistantId))
        streamingIdRef.current = null
        setError(requestError)
        setStatus(Status.ERROR)
      } finally {
        abortRef.current = null
      }
    },
    [conversationId, status, patchStreaming],
  )

  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((message) => message.role === 'user')
    if (!lastUser) return
    // Drop the failed exchange so the retry does not duplicate it on screen.
    setMessages((current) => {
      const index = current.findIndex((message) => message.id === lastUser.id)
      return index === -1 ? current : current.slice(0, index)
    })
    setError(null)
    send(lastUser.content)
  }, [messages, send])

  return {
    messages,
    status,
    error,
    send,
    stop,
    retry,
    isBusy: status === Status.SENDING || status === Status.STREAMING,
    clearError: () => setError(null),
  }
}
