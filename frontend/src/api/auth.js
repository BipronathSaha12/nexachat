import { request, tokens } from './client'

export async function register({ email, password, displayName }) {
  const data = await request('/api/auth/register/', {
    method: 'POST',
    auth: false,
    body: { email, password, display_name: displayName || '' },
  })
  tokens.set(data)
  return data.user
}

export async function login({ email, password }) {
  const data = await request('/api/auth/login/', {
    method: 'POST',
    auth: false,
    body: { email, password },
  })
  tokens.set(data)
  return data.user
}

export async function logout() {
  const refresh = tokens.refresh
  try {
    if (refresh) await request('/api/auth/logout/', { method: 'POST', body: { refresh } })
  } catch {
    // The server may already have expired the token. Local state is cleared regardless,
    // so the user is never stuck in a session they asked to leave.
  } finally {
    tokens.clear()
  }
}

export function me() {
  return request('/api/auth/me/')
}
