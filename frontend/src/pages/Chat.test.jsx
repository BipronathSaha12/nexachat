import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { tokens } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import Chat from './Chat'

vi.mock('../api/chat', () => ({ streamChat: vi.fn() }))
const { streamChat } = await import('../api/chat')

const CONVERSATIONS = [
  { id: 'c1', title: 'React hooks', message_count: 2 },
  { id: 'c2', title: 'Django ORM', message_count: 0 },
]

const HISTORY = {
  id: 'c1',
  title: 'React hooks',
  messages: [
    { id: 'm1', role: 'user', content: 'What is useState?' },
    { id: 'm2', role: 'assistant', content: 'State in a **function component**.' },
  ],
}

/** Route REST calls to canned responses; the SSE path is mocked separately. */
function mockApi({ conversations = CONVERSATIONS, detail = HISTORY } = {}) {
  return vi.fn(async (url, options = {}) => {
    const path = String(url)
    const method = options.method ?? 'GET'
    const ok = (body, status = 200) => ({ ok: true, status, json: async () => body })

    if (path.includes('/api/auth/me/')) return ok({ id: 'u1', email: 'a@b.c' })
    if (path.match(/\/api\/conversations\/$/) && method === 'GET') return ok({ results: conversations })
    if (path.match(/\/api\/conversations\/[^/]+\/$/) && method === 'GET') return ok(detail)
    if (method === 'PATCH' || method === 'DELETE') return ok(null, 204)
    return ok({})
  })
}

function renderChat(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/c/:conversationId" element={<Chat />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  tokens.set({ access: 'a', refresh: 'r', user: { id: 'u1', email: 'a@b.c' } })
  global.fetch = mockApi()
})

describe('Chat screen', () => {
  it('lists the user’s conversations in the sidebar', async () => {
    renderChat()
    const sidebar = screen.getByRole('complementary', { name: 'Conversations' })
    expect(await within(sidebar).findByRole('button', { name: 'React hooks' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('button', { name: 'Django ORM' })).toBeInTheDocument()
  })

  it('loads the history of the selected conversation', async () => {
    renderChat('/c/c1')
    expect(await screen.findByText('What is useState?')).toBeInTheDocument()
    expect(await screen.findByText('function component')).toBeInTheDocument()
  })

  it('shows the empty state for a new conversation', async () => {
    renderChat()
    expect(await screen.findByRole('heading', { name: /what can i help you with/i })).toBeInTheDocument()
  })

  it('streams a reply and renders its Markdown', async () => {
    streamChat.mockImplementation(async (_request, handlers) => {
      handlers.onMeta?.({ conversation_id: 'c9' })
      handlers.onDelta?.('Use `useState` ')
      handlers.onDelta?.('to hold state.')
      handlers.onDone?.({ message_id: 'm9', conversation_id: 'c9', title: 'Using useState' })
    })

    renderChat()
    await screen.findByRole('heading', { name: /what can i help you with/i })

    await userEvent.type(screen.getByLabelText('Message'), 'How do I hold state?{Enter}')

    expect(await screen.findByText('How do I hold state?')).toBeInTheDocument()
    expect(await screen.findByText(/to hold state/)).toBeInTheDocument()
    // Inline code from the stream is rendered as code, not literal backticks.
    expect(screen.getByText('useState').tagName).toBe('CODE')
  })

  it('adopts the server-assigned title in the sidebar', async () => {
    streamChat.mockImplementation(async (_request, handlers) => {
      handlers.onMeta?.({ conversation_id: 'c9' })
      handlers.onDelta?.('ok')
      handlers.onDone?.({ message_id: 'm9', conversation_id: 'c9', title: 'Generated Title' })
    })

    renderChat()
    await screen.findByRole('heading', { name: /what can i help you with/i })
    await userEvent.type(screen.getByLabelText('Message'), 'hi{Enter}')

    const sidebar = screen.getByRole('complementary', { name: 'Conversations' })
    expect(await within(sidebar).findByRole('button', { name: 'Generated Title' })).toBeInTheDocument()
  })

  it('shows a retryable error when the stream fails', async () => {
    const { ApiError } = await import('../api/client')
    streamChat.mockImplementation(async (_request, handlers) => {
      handlers.onError?.(
        new ApiError({ code: 'upstream_rate_limited', message: 'Please retry shortly.', status: 200 }),
      )
    })

    renderChat()
    await screen.findByRole('heading', { name: /what can i help you with/i })
    await userEvent.type(screen.getByLabelText('Message'), 'hi{Enter}')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Please retry shortly.')
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('renames a conversation optimistically', async () => {
    renderChat('/c/c1')
    const sidebar = screen.getByRole('complementary', { name: 'Conversations' })
    await within(sidebar).findByRole('button', { name: 'React hooks' })

    await userEvent.click(within(sidebar).getByRole('button', { name: 'Rename React hooks' }))
    const input = within(sidebar).getByLabelText('Conversation title')
    await userEvent.clear(input)
    await userEvent.type(input, 'Hooks deep dive{Enter}')

    expect(await within(sidebar).findByRole('button', { name: 'Hooks deep dive' })).toBeInTheDocument()
  })

  it('removes a deleted conversation from the sidebar', async () => {
    renderChat('/c/c1')
    const sidebar = screen.getByRole('complementary', { name: 'Conversations' })
    await within(sidebar).findByRole('button', { name: 'React hooks' })

    await userEvent.click(within(sidebar).getByRole('button', { name: 'Delete Django ORM' }))
    await userEvent.click(within(sidebar).getByRole('button', { name: /Confirm delete Django ORM/ }))

    await waitFor(() =>
      expect(within(sidebar).queryByRole('button', { name: 'Django ORM' })).not.toBeInTheDocument(),
    )
  })

  it('falls back to a new conversation when the id is not found', async () => {
    global.fetch = vi.fn(async (url) => {
      const path = String(url)
      if (path.includes('/api/auth/me/')) return { ok: true, status: 200, json: async () => ({ id: 'u1' }) }
      if (path.match(/\/api\/conversations\/$/)) {
        return { ok: true, status: 200, json: async () => ({ results: [] }) }
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: { code: 'not_found', message: 'Conversation not found.' } }),
      }
    })

    renderChat('/c/does-not-exist')
    expect(await screen.findByRole('heading', { name: /what can i help you with/i })).toBeInTheDocument()
  })

  it('signs the user out from the sidebar', async () => {
    renderChat()
    const sidebar = screen.getByRole('complementary', { name: 'Conversations' })
    await within(sidebar).findByRole('button', { name: 'React hooks' })

    await userEvent.click(within(sidebar).getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(tokens.access).toBeNull())
  })
})
