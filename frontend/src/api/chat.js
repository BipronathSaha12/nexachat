/**
 * Streaming chat client (PRD 6).
 *
 * EventSource cannot POST or send an Authorization header, so the SSE stream is read
 * off `fetch` manually. Frames are separated by a blank line and can be split across
 * network chunks, so partial frames are buffered rather than parsed eagerly.
 */

import { ApiError, authHeaders, buildUrl, refreshAccessToken, tokens } from './client'

/** Split a buffer into complete SSE frames, returning the unterminated remainder. */
export function splitFrames(buffer) {
  const frames = []
  let rest = buffer.replace(/\r\n/g, '\n')
  let index = rest.indexOf('\n\n')
  while (index !== -1) {
    frames.push(rest.slice(0, index))
    rest = rest.slice(index + 2)
    index = rest.indexOf('\n\n')
  }
  return { frames, rest }
}

/** Parse one frame into `{ event, data }`. Comment frames (heartbeats) return null. */
export function parseFrame(frame) {
  let event = null
  const dataLines = []

  for (const line of frame.split('\n')) {
    if (!line || line.startsWith(':')) continue // heartbeat or padding
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
  }

  if (!event) return null

  let data = {}
  if (dataLines.length) {
    try {
      data = JSON.parse(dataLines.join('\n'))
    } catch {
      return null // a frame we cannot read is not a frame we should act on
    }
  }
  return { event, data }
}

async function openStream({ conversationId, message, signal, allowRetry = true }) {
  const response = await fetch(buildUrl('/api/chat/'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
    body: JSON.stringify({
      conversation_id: conversationId ?? null,
      message,
    }),
    signal,
  })

  if (response.status === 401 && allowRetry) {
    const access = await refreshAccessToken()
    if (access) return openStream({ conversationId, message, signal, allowRetry: false })
    tokens.clear()
  }

  return response
}

/**
 * Send a message and stream the reply.
 *
 * Failures arrive two ways, and callers must handle both:
 *   * before the response starts -- a real HTTP status, thrown as ApiError
 *   * after streaming has begun  -- an `error` frame on a 200, passed to onError
 */
export async function streamChat(
  { conversationId, message, signal },
  { onMeta, onDelta, onDone, onError } = {},
) {
  let response
  try {
    response = await openStream({ conversationId, message, signal })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError({
      code: 'network_error',
      message: 'Could not reach the server. Check your connection.',
      status: 0,
    })
  }

  if (!response.ok) {
    let body = null
    try {
      body = await response.json()
    } catch {
      /* fall through to the generic message */
    }
    const envelope = body?.error ?? {}
    throw new ApiError({
      code: envelope.code || 'internal_error',
      message: envelope.message || 'The server rejected the request.',
      status: response.status,
      requestId: envelope.request_id,
      details: envelope.details,
    })
  }

  if (!response.body) {
    throw new ApiError({
      code: 'internal_error',
      message: 'Streaming is not supported by this browser.',
      status: 0,
    })
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawTerminal = false

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const { frames, rest } = splitFrames(buffer)
      buffer = rest

      for (const raw of frames) {
        const parsed = parseFrame(raw)
        if (!parsed) continue

        switch (parsed.event) {
          case 'meta':
            onMeta?.(parsed.data)
            break
          case 'delta':
            if (parsed.data.text) onDelta?.(parsed.data.text)
            break
          case 'done':
            sawTerminal = true
            onDone?.(parsed.data)
            break
          case 'error':
            sawTerminal = true
            onError?.(
              new ApiError({
                code: parsed.data.code || 'internal_error',
                message: parsed.data.message || 'The response failed.',
                status: 200,
                requestId: parsed.data.request_id,
              }),
            )
            break
          default:
            break
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {})
  }

  // The server always sends a terminal frame. Its absence means the connection
  // dropped mid-stream, which the caller must not mistake for a completed reply.
  if (!sawTerminal) {
    onError?.(
      new ApiError({
        code: 'stream_interrupted',
        message: 'The connection closed before the reply finished.',
        status: 0,
      }),
    )
  }
}
