import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, request, tokens } from './client'

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

describe('token storage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips tokens and the user', () => {
    tokens.set({ access: 'a', refresh: 'r', user: { email: 'x@y.z' } })
    expect(tokens.access).toBe('a')
    expect(tokens.refresh).toBe('r')
    expect(tokens.user).toEqual({ email: 'x@y.z' })
  })

  it('clears everything on logout', () => {
    tokens.set({ access: 'a', refresh: 'r', user: { email: 'x@y.z' } })
    tokens.clear()
    expect(tokens.access).toBeNull()
    expect(tokens.user).toBeNull()
  })

  it('survives a corrupted stored user', () => {
    localStorage.setItem('chatbot.user', '{not json')
    expect(tokens.user).toBeNull()
  })
})

describe('request', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('attaches the bearer token', async () => {
    tokens.set({ access: 'my-token' })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    global.fetch = fetchMock

    await request('/api/auth/me/')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer my-token')
  })

  it('omits the token when auth is disabled', async () => {
    tokens.set({ access: 'my-token' })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    global.fetch = fetchMock

    await request('/api/auth/login/', { method: 'POST', auth: false, body: {} })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('turns the error envelope into a typed ApiError', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        { error: { code: 'validation_error', message: 'Bad input', request_id: 'r1', details: { email: ['taken'] } } },
        400,
      ),
    )

    const error = await request('/api/auth/register/', { auth: false }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('validation_error')
    expect(error.requestId).toBe('r1')
    expect(error.fieldErrors).toEqual({ email: 'taken' })
  })

  it('refreshes once on a 401 and replays the request', async () => {
    tokens.set({ access: 'stale', refresh: 'refresh-token' })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ access: 'fresh', refresh: 'refresh-2' }))
      .mockResolvedValueOnce(jsonResponse({ email: 'x@y.z' }))
    global.fetch = fetchMock

    const result = await request('/api/auth/me/')
    expect(result).toEqual({ email: 'x@y.z' })
    expect(tokens.access).toBe('fresh')
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh')
  })

  it('clears the session when the refresh token is rejected', async () => {
    tokens.set({ access: 'stale', refresh: 'dead' })
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401))

    await request('/api/auth/me/').catch(() => {})
    expect(tokens.access).toBeNull()
  })

  it('does not retry a 401 more than once', async () => {
    tokens.set({ access: 'stale', refresh: 'refresh-token' })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ access: 'fresh' }))
      .mockResolvedValueOnce(jsonResponse({}, 401))
    global.fetch = fetchMock

    await request('/api/auth/me/').catch(() => {})
    expect(fetchMock).toHaveBeenCalledTimes(3) // original, refresh, replay -- no loop
  })

  it('reports a network failure in the user’s language', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await request('/api/auth/me/', { auth: false }).catch((e) => e)
    expect(error.code).toBe('network_error')
    expect(error.message).toMatch(/connection/i)
  })

  it('returns null for a 204', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null })
    await expect(request('/api/conversations/x/', { method: 'DELETE' })).resolves.toBeNull()
  })
})
