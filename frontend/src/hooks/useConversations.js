import { useCallback, useEffect, useState } from 'react'

import * as api from '../api/conversations'

/** Sidebar state: the list, plus optimistic rename and delete. */
export function useConversations() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async (signal) => {
    try {
      setError(null)
      const list = await api.listConversations({ signal })
      setConversations(list)
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  const upsert = useCallback((conversation) => {
    setConversations((current) => {
      const existing = current.find((item) => item.id === conversation.id)
      const next = existing
        ? current.map((item) => (item.id === conversation.id ? { ...item, ...conversation } : item))
        : [conversation, ...current]
      return next
    })
  }, [])

  const setTitle = useCallback((id, title) => {
    setConversations((current) =>
      current.map((item) => (item.id === id ? { ...item, title } : item)),
    )
  }, [])

  const rename = useCallback(
    async (id, title) => {
      const previous = conversations.find((item) => item.id === id)?.title
      setTitle(id, title) // optimistic
      try {
        await api.renameConversation(id, title)
      } catch (renameError) {
        if (previous !== undefined) setTitle(id, previous) // roll back
        throw renameError
      }
    },
    [conversations, setTitle],
  )

  const remove = useCallback(
    async (id) => {
      const snapshot = conversations
      setConversations((current) => current.filter((item) => item.id !== id))
      try {
        await api.deleteConversation(id)
      } catch (deleteError) {
        setConversations(snapshot) // roll back
        throw deleteError
      }
    },
    [conversations],
  )

  return { conversations, loading, error, refresh, upsert, setTitle, rename, remove }
}
