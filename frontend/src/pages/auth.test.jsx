import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_DEMO_EMAIL', 'demo@devtechguru.cloud')
vi.stubEnv('VITE_DEMO_PASSWORD', 'TryTheChatbot!2026')

import { tokens } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'
import Login from './Login'
import Register from './Register'

function renderApp(initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Chat screen</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

describe('login', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('stores tokens and lands on the chat screen', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ access: 'a', refresh: 'r', user: { id: '1', email: 'a@b.c' } }, 200),
    )

    renderApp()
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.c')
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Chat screen')).toBeInTheDocument()
    expect(tokens.access).toBe('a')
  })

  it('signs in with the published demo credentials in one click', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ access: 'a', refresh: 'r', user: { id: '1', email: 'demo@devtechguru.cloud' } }, 200),
    )
    global.fetch = fetchMock

    renderApp()
    await userEvent.click(screen.getByRole('button', { name: /use demo/i }))

    expect(await screen.findByText('Chat screen')).toBeInTheDocument()
    // The fields are filled too, so the user can see what was used.
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toEqual({ email: 'demo@devtechguru.cloud', password: 'TryTheChatbot!2026' })
  })

  it('shows the server message on bad credentials and stays put', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        { error: { code: 'authentication_error', message: 'No active account found' } },
        401,
      ),
    )

    renderApp()
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.c')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No active account found')
    expect(tokens.access).toBeNull()
  })
})

describe('register', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('surfaces field-level validation next to the input', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'validation_error',
            message: 'The request was invalid.',
            details: { password: ['This password is too short.'] },
          },
        },
        400,
      ),
    )

    renderApp('/register')
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.c')
    await userEvent.type(screen.getByLabelText('Password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('This password is too short.')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('protected routes', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('redirects an anonymous visitor to the login screen', async () => {
    global.fetch = vi.fn()
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('restores a stored session on reload (PRD 5.1)', async () => {
    tokens.set({ access: 'stored', refresh: 'r', user: { id: '1', email: 'a@b.c' } })
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ id: '1', email: 'a@b.c' }))

    renderApp('/')
    expect(await screen.findByText('Chat screen')).toBeInTheDocument()
  })

  it('signs the user out when the stored token has been revoked', async () => {
    tokens.set({ access: 'revoked', refresh: 'also-revoked', user: { id: '1', email: 'a@b.c' } })
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 401))

    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    await waitFor(() => expect(tokens.access).toBeNull())
  })
})
