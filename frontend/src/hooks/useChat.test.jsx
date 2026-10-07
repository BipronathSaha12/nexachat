import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/client'
import { Status, useChat } from './useChat'

vi.mock('../api/chat', () => ({ streamChat: vi.fn() }))
const { streamChat } = await import('../api/chat')

/** Drive the callbacks streamChat would invoke for a given script. */
function scriptStream(steps) {
  streamChat.mockImplementation(async (_request, handlers) => {
    for (const step of steps) {
      if (step.meta) handlers.onMeta?.(step.meta)
      if (step.delta) handlers.onDelta?.(step.delta)
      if (step.done) handlers.onDone?.(step.done)
      if (step.error) handlers.onError?.(step.error)
      if (step.throw) throw step.throw
    }
  })
}

describe('useChat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts idle with the supplied history', () => {
    const initial = [{ id: 'm1', role: 'user', content: 'earlier' }]
    const { result } = renderHook(() => useChat({ conversationId: 'c1', initialMessages: initial }))
    expect(result.current.status).toBe(Status.IDLE)
    expect(result.current.messages).toEqual(initial)
  })

  it('shows the user message before any response arrives (PRD 5.2)', async () => {
    let release
    streamChat.mockImplementation(() => new Promise((resolve) => (release = resolve)))

    const { result } = renderHook(() => useChat({ conversationId: 'c1' }))
    act(() => {
      result.current.send('hello')
    })

    await waitFor(() => expect(result.current.messages).toHaveLength(2))
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'hello' })
    expect(result.current.messages[1]).toMatchObject({ role: 'assistant', content: '', streaming: true })
    expect(result.current.status).toBe(Status.SENDING)
    act(() => release())
  })

  it('moves idle -> sending -> streaming -> completed', async () => {
    scriptStream([{ delta: 'Hel' }, { delta: 'lo' }, { done: { message_id: 'm9' } }])

    const { result } = renderHook(() => useChat({ conversationId: 'c1' }))
    await act(async () => {
      await result.current.send('hi')
    })

    await waitFor(() => expect(result.current.status).toBe(Status.COMPLETED))
    const assistant = result.current.messages.at(-1)
    expect(assistant.content).toBe('Hello')
    expect(assistant.streaming).toBe(false)
    expect(assistant.id).toBe('m9')
  })

  it('reports the new conversation id from the meta frame', async () => {
    const onConversationCreated = vi.fn()
    scriptStream([{ meta: { conversation_id: 'new-id' } }, { done: {} }])

    const { result } = renderHook(() =>
      useChat({ conversationId: undefined, onConversationCreated }),
    )
    await act(async () => {
      await result.current.send('hi')
    })
    expect(onConversationCreated).toHaveBeenCalledWith('new-id')
  })

  it('does not re-announce the conversation on an existing thread', async () => {
    const onConversationCreated = vi.fn()
    scriptStream([{ meta: { conversation_id: 'c1' } }, { done: {} }])

    const { result } = renderHook(() => useChat({ conversationId: 'c1', onConversationCreated }))
    await act(async () => {
      await result.current.send('hi')
    })
    expect(onConversationCreated).not.toHaveBeenCalled()
  })

  it('reports a generated title', async () => {
    const onTitle = vi.fn()
    scriptStream([{ done: { conversation_id: 'c1', title: 'A Title' } }])

    const { result } = renderHook(() => useChat({ conversationId: 'c1', onTitle }))
    await act(async () => {
      await result.current.send('hi')
    })
    expect(onTitle).toHaveBeenCalledWith('c1', 'A Title')
  })

  it('keeps partial text on screen when the stream fails mid-flight', async () => {
    const failure = new ApiError({ code: 'upstream_error', message: 'boom', status: 200 })
    scriptStream([{ delta: 'Half ' }, { error: failure }])

    const { result } = renderHook(() => useChat({ conversationId: 'c1' }))
    await act(async () => {
      await result.current.send('hi')
    })

    await waitFor(() => expect(result.current.status).toBe(Status.ERROR))
    expect(result.current.messages.at(-1)).toMatchObject({ content: 'Half ', failed: true, streaming: false })
    expect(result.current.error).toBe(failure)
  })

  it('removes the empty placeholder when the request fails before streaming', async () => {
    const failure = new ApiError({ code: 'rate_limited', message: 'slow down', status: 429 })
    scriptStream([{ throw: failure }])

    const { result } = renderHook(() => useChat({ conversationId: 'c1' }))
    await act(async () => {
      await result.current.send('hi')
    })

    await waitFor(() => expect(result.current.status).toBe(Status.ERROR))
    // The user's own message stays; the empty assistant bubble does not.
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].role).toBe('user')
  })

  it('ignores a send while a stream is already running', async () => {
    streamChat.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useChat({ conversationId: 'c1' }))

    act(() => {
      result.current.send('first')
    })
    await waitFor(() => expect(result.current.isBusy).toBe(true))
    await act(async () => {
      await result.current.send('second')
    })
    expect(streamChat).toHaveBeenCalledTimes(1)
  })

  it('ignores an empty or whitespace-only message', async () => {
    const { result } = renderHook(() => useChat({ conversationId: 'c1' }))
    await act(async () => {
      await result.current.send('   ')
    })
    expect(streamChat).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(0)
  })

  it('stop() ends the stream and marks the message stopped', async () => {
    streamChat.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useChat({ conversationId: 'c1' }))

    act(() => {
      result.current.send('hi')
    })
    await waitFor(() => expect(result.current.isBusy).toBe(true))
    act(() => result.current.stop())

    expect(result.current.status).toBe(Status.COMPLETED)
    expect(result.current.messages.at(-1)).toMatchObject({ stopped: true, streaming: false })
  })

  it('retry() resends the last user message without duplicating it', async () => {
    scriptStream([{ throw: new ApiError({ code: 'network_error', message: 'x', status: 0 }) }])
    const { result } = renderHook(() => useChat({ conversationId: 'c1' }))

    await act(async () => {
      await result.current.send('ask me')
    })
    await waitFor(() => expect(result.current.status).toBe(Status.ERROR))

    scriptStream([{ delta: 'answer' }, { done: {} }])
    await act(async () => {
      result.current.retry()
    })

    await waitFor(() => expect(result.current.status).toBe(Status.COMPLETED))
    const userMessages = result.current.messages.filter((m) => m.role === 'user')
    expect(userMessages).toHaveLength(1)
    expect(result.current.messages.at(-1).content).toBe('answer')
  })

  it('resets when the conversation changes', async () => {
    scriptStream([{ delta: 'hi' }, { done: {} }])
    const { result, rerender } = renderHook(
      ({ id, initial }) => useChat({ conversationId: id, initialMessages: initial }),
      { initialProps: { id: 'c1', initial: [] } },
    )

    await act(async () => {
      await result.current.send('hello')
    })
    expect(result.current.messages.length).toBeGreaterThan(0)

    rerender({ id: 'c2', initial: [{ id: 'x', role: 'user', content: 'other thread' }] })
    expect(result.current.status).toBe(Status.IDLE)
    expect(result.current.messages).toEqual([{ id: 'x', role: 'user', content: 'other thread' }])
  })
})
