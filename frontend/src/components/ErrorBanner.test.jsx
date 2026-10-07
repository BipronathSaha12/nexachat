import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/client'
import ErrorBanner from './ErrorBanner'

const make = (code, extra = {}) =>
  new ApiError({ code, message: 'Something failed', status: 500, ...extra })

describe('ErrorBanner', () => {
  it('renders nothing without an error', () => {
    const { container } = render(<ErrorBanner error={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('announces the failure to assistive technology', () => {
    render(<ErrorBanner error={make('internal_error')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Something failed')
  })

  it('shows the request id so a user can quote it', () => {
    render(<ErrorBanner error={make('upstream_error', { requestId: 'abc123' })} />)
    expect(screen.getByText(/abc123/)).toBeInTheDocument()
  })

  it('offers Retry for a transient failure', async () => {
    const onRetry = vi.fn()
    render(<ErrorBanner error={make('upstream_timeout')} onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('does not offer Retry for a failure the user must fix', () => {
    render(<ErrorBanner error={make('validation_error')} onRetry={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('can be dismissed', async () => {
    const onDismiss = vi.fn()
    render(<ErrorBanner error={make('not_found')} onDismiss={onDismiss} />)
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
