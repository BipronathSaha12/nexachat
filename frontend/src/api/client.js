/**
 * HTTP client.
 *
 * Owns two things the rest of the app should not think about:
 *   1. attaching the access token, and refreshing it once on a 401
 *   2. turning the backend's error envelope into a typed ApiError
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

const ACCESS_KEY = 'chatbot.access'
const REFRESH_KEY = 'chatbot.refresh'
const USER_KEY = 'chatbot.user'

export class ApiError extends Error {
  constructor({ code, message, status, requestId, details }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.requestId = requestId
    this.details = details
  }

  /** Field-level validation messages, flattened for display. */
  get fieldErrors() {
    if (!this.details || typeof this.details !== 'object') return {}
    return Object.fromEntries(
      Object.entries(this.details).map(([field, value]) => [
        field,
        Array.isArray(value) ? value.join(' ') : String(value),
      ]),
    )
  }
}

/* ---------------------------------------------------------------- tokens -- */

// localStorage survives a reload, which is what "authentication persistence"
// (PRD 5.1) requires. The tradeoff is documented in docs/adr/0005.
export const tokens = {
  get access() {
    return safeGet(ACCESS_KEY)
  },
  get refresh() {
    return safeGet(REFRESH_KEY)
  },
  get user() {
    const raw = safeGet(USER_KEY)
    try {
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  set({ access, refresh, user }) {
    safeSet(ACCESS_KEY, access)
    if (refresh) safeSet(REFRESH_KEY, refresh)
    if (user) safeSet(USER_KEY, JSON.stringify(user))
  },
  clear() {
    for (const key of [ACCESS_KEY, REFRESH_KEY, USER_KEY]) safeRemove(key)
  },
}

function safeGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null // private mode, or storage disabled
  }
}
function safeSet(key, value) {
  try {
    if (value != null) localStorage.setItem(key, value)
  } catch {
    /* storage unavailable; the session simply will not persist */
  }
}
function safeRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* nothing to do */
  }
}

/* --------------------------------------------------------------- refresh -- */

let refreshInFlight = null

/** Exchange the refresh token for a new access token. Concurrent callers share one request. */
export async function refreshAccessToken() {
  const refresh = tokens.refresh
  if (!refresh) return null

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${BASE}/api/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })
      if (!response.ok) return null
      const data = await response.json()
      tokens.set({ access: data.access, refresh: data.refresh })
      return data.access
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

/* ---------------------------------------------------------------- errors -- */

async function toApiError(response) {
  let body = null
  try {
    body = await response.json()
  } catch {
    /* an empty or non-JSON body is handled below */
  }
  const envelope = body?.error ?? {}
  return new ApiError({
    code: envelope.code || 'internal_error',
    message: envelope.message || fallbackMessage(response.status),
    status: response.status,
    requestId: envelope.request_id,
    details: envelope.details,
  })
}

function fallbackMessage(status) {
  if (status === 0) return 'Could not reach the server. Check your connection.'
  if (status >= 500) return 'The server is having trouble. Please try again.'
  return 'Something went wrong. Please try again.'
}

/* ---------------------------------------------------------------- request -- */

export function buildUrl(path) {
  return path.startsWith('http') ? path : `${BASE}${path}`
}

export function authHeaders(extra = {}) {
  const access = tokens.access
  return access ? { ...extra, Authorization: `Bearer ${access}` } : { ...extra }
}

/**
 * Authenticated JSON request. Retries once after refreshing an expired access token.
 * `auth: false` skips the token entirely (login, register).
 */
export async function request(path, { method = 'GET', body, auth = true, signal, retry = true } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json'
  }
  if (auth) Object.assign(headers, authHeaders())

  // GET and HEAD must not carry a body; fetch rejects the request outright if they do.
  const sendsBody = body !== undefined && method !== 'GET' && method !== 'HEAD'

  let response
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers,
      ...(sendsBody ? { body: JSON.stringify(body) } : {}),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError({ code: 'network_error', message: fallbackMessage(0), status: 0 })
  }

  if (response.status === 401 && auth && retry) {
    const access = await refreshAccessToken()
    if (access) return request(path, { method, body, auth, signal, retry: false })
    tokens.clear()
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204 || response.status === 205) return null

  return response.status === 200 || response.status === 201 ? response.json() : null
}
