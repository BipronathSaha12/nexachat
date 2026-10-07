import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import DemoCredentials, { getDemoCredentials } from './DemoCredentials'

// No demo env vars: a private deployment must not show the panel at all.
vi.stubEnv('VITE_DEMO_EMAIL', '')
vi.stubEnv('VITE_DEMO_PASSWORD', '')

describe('DemoCredentials without configuration', () => {
  it('renders nothing', () => {
    const { container } = render(<DemoCredentials onUse={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('reports no credentials', () => {
    expect(getDemoCredentials()).toBeNull()
  })
})
