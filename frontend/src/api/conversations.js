import { request } from './client'

export async function listConversations({ signal } = {}) {
  const data = await request('/api/conversations/', { signal })
  return data?.results ?? []
}

export function getConversation(id, { signal } = {}) {
  return request(`/api/conversations/${id}/`, { signal })
}

export function createConversation({ title } = {}) {
  return request('/api/conversations/', {
    method: 'POST',
    body: { title: title || 'New conversation' },
  })
}

export function renameConversation(id, title) {
  return request(`/api/conversations/${id}/`, { method: 'PATCH', body: { title } })
}

export function deleteConversation(id) {
  return request(`/api/conversations/${id}/`, { method: 'DELETE' })
}
