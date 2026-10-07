import { describe, expect, it, vi, beforeEach } from 'vitest'

import { parseFrame, splitFrames, streamChat } from './chat'
import { tokens } from './client'

describe('splitFrames', () => {
  it('returns only complete frames and keeps the remainder', () => {
    const { frames, rest } = splitFrames('event: a\ndata: {}\n\nevent: b\ndata: {"x":1}')
    expect(frames).toEqual(['event: a\ndata: {}'])
    expect(rest).toBe('event: b\ndata: {"x":1}')
  })

  it('handles CRLF line endings', () => {
    const { frames } = splitFrames('event: a\r\ndata: {}\r\n\r\n')
    expect(frames).toEqual(['event: a\ndata: {}'])
  })

  it('returns nothing when no frame has terminated', () => {
    const { frames, rest } = splitFrames('event: a\ndata: {"partial"')
    expect(frames).toEqual([])
    expect(rest).toBe('event: a\ndata: {"partial"')
  })
})

describe('parseFrame', () => {
  it('parses an event and its JSON payload', () => {
    expect(parseFrame('event: delta\ndata: {"text":"hi"}')).toEqual({
      event: 'delta',
      data: { text: 'hi' },
    })
  })

  it('ignores heartbeat comment frames', () => {
    expect(parseFrame(': heartbeat')).toBeNull()
  })

  it('ignores a frame with unreadable JSON rather than throwing', () => {
    expect(parseFrame('event: delta\ndata: {oops')).toBeNull()
  })

  it('joins multi-line data payloads', () => {
    expect(parseFrame('event: done\ndata: {\ndata: "a": 1\ndata: }')).toEqual({
      event: 'done',
      data: { a: 1 },
    })
  })
})

/** Build a fetch Response whose body streams `chunks`, split at arbitrary boundaries. */
function sseResponse(chunks, { status = 200 } = {}) {
  const encoder = new TextEncoder()
  const queue = [...chunks]
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader: () => ({
        read: async () =>
          queue.length ? { done: false, value: encoder.encode(queue.shift()) } : { done: true },
        cancel: async () => {},
      }),
    },
    json: async () => ({}),
  }
}

describe('streamChat', () => {
  beforeEach(() => {
    tokens.set({ access: 'token', refresh: 'refresh' })
  })

  it('dispatches meta, delta and done in order', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      sseResponse([
        'event: meta\ndata: {"conversation_id":"c1"}\n\n',
        'event: delta\ndata: {"text":"Hello "}\n\n',
        'event: delta\ndata: {"text":"world"}\n\n',
        'event: done\ndata: {"message_id":"m1","title":"T"}\n\n',
      ]),
    )

    const seen = { deltas: [], meta: null, done: null, error: null }
    await streamChat(
      { message: 'hi' },
      {
        onMeta: (m) => (seen.meta = m),
        onDelta: (t) => seen.deltas.push(t),
        onDone: (d) => (seen.done = d),
        onError: (e) => (seen.error = e),
      },
    )

    expect(seen.meta).toEqual({ conversation_id: 'c1' })
    expect(seen.deltas.join('')).toBe('Hello world')
    expect(seen.done.message_id).toBe('m1')
    expect(seen.error).toBeNull()
  })

  it('reassembles a frame split across network chunks', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      sseResponse(['event: delta\nda', 'ta: {"text":"split"}\n', '\nevent: done\ndata: {}\n\n']),
    )

    const deltas = []
    await streamChat({ message: 'hi' }, { onDelta: (t) => deltas.push(t) })
    expect(deltas).toEqual(['split'])
  })

  it('passes an in-band error frame to onError', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      sseResponse([
        'event: delta\ndata: {"text":"partial"}\n\n',
        'event: error\ndata: {"code":"upstream_rate_limited","message":"Slow down","request_id":"r1"}\n\n',
      ]),
    )

    let error = null
    const deltas = []
    await streamChat({ message: 'hi' }, { onDelta: (t) => deltas.push(t), onError: (e) => (error = e) })

    // Text already delivered must survive; the caller decides how to present it.
    expect(deltas).toEqual(['partial'])
    expect(error.code).toBe('upstream_rate_limited')
    expect(error.requestId).toBe('r1')
  })

  it('reports an interrupted stream when no terminal frame arrives', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(sseResponse(['event: delta\ndata: {"text":"cut off"}\n\n']))

    let error = null
    await streamChat({ message: 'hi' }, { onError: (e) => (error = e) })
    expect(error.code).toBe('stream_interrupted')
  })

  it('throws a typed error when the request fails before streaming starts', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: { code: 'rate_limited', message: 'Too many requests', request_id: 'r2' },
      }),
    })

    await expect(streamChat({ message: 'hi' })).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
      requestId: 'r2',
    })
  })

  it('refreshes the access token once on a 401 and retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access: 'new-token' }) })
      .mockResolvedValueOnce(sseResponse(['event: done\ndata: {}\n\n']))
    global.fetch = fetchMock

    let done = null
    await streamChat({ message: 'hi' }, { onDone: (d) => (done = d) })

    expect(done).toEqual({})
    expect(fetchMock.mock.calls[1][0]).toContain('/api/auth/refresh/')
    expect(tokens.access).toBe('new-token')
  })
})
