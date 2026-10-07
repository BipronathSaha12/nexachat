import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import DemoCredentials, { getDemoCredentials } from './DemoCredentials'

vi.stubEnv('VITE_DEMO_EMAIL', 'demo@devtechguru.cloud')
vi.stubEnv('VITE_DEMO_PASSWORD', 'TryTheChatbot!2026')

describe('DemoCredentials', () => {
  it('publishes the credentials so they can be read or copied', () => {
    render(<DemoCredentials onUse={vi.fn()} />)
    expect(screen.getByText('demo@devtechguru.cloud')).toBeInTheDocument()
    expect(screen.getByText('TryTheChatbot!2026')).toBeInTheDocument()
  })

  it('hands the credentials back on one click', async () => {
    const onUse = vi.fn()
    render(<DemoCredentials onUse={onUse} />)
    await userEvent.click(screen.getByRole('button', { name: /use demo/i }))
    expect(onUse).toHaveBeenCalledWith({
      email: 'demo@devtechguru.cloud',
      password: 'TryTheChatbot!2026',
    })
  })

  it('warns that the account is shared', () => {
    render(<DemoCredentials onUse={vi.fn()} />)
    expect(screen.getByText(/shared account/i)).toBeInTheDocument()
  })

  it('is disabled while a sign-in is in flight', () => {
    render(<DemoCredentials onUse={vi.fn()} disabled />)
    expect(screen.getByRole('button', { name: /use demo/i })).toBeDisabled()
  })

  it('exposes the parsed credentials', () => {
    expect(getDemoCredentials()).toEqual({
      email: 'demo@devtechguru.cloud',
      password: 'TryTheChatbot!2026',
    })
  })
})
