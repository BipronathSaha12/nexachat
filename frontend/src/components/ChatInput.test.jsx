import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ChatInput from './ChatInput'

describe('ChatInput', () => {
  it('sends on Enter and clears the field', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} onStop={vi.fn()} isBusy={false} />)

    const box = screen.getByLabelText('Message')
    await userEvent.type(box, 'hello{Enter}')

    expect(onSend).toHaveBeenCalledWith('hello')
    expect(box).toHaveValue('')
  })

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} onStop={vi.fn()} isBusy={false} />)

    const box = screen.getByLabelText('Message')
    await userEvent.type(box, 'line one{Shift>}{Enter}{/Shift}line two')

    expect(onSend).not.toHaveBeenCalled()
    expect(box.value).toContain('\n')
  })

  it('does not send whitespace only', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} onStop={vi.fn()} isBusy={false} />)
    await userEvent.type(screen.getByLabelText('Message'), '   {Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables Send until there is text', async () => {
    render(<ChatInput onSend={vi.fn()} onStop={vi.fn()} isBusy={false} />)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Message'), 'x')
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
  })

  it('swaps Send for Stop while a reply is streaming', async () => {
    const onStop = vi.fn()
    render(<ChatInput onSend={vi.fn()} onStop={onStop} isBusy />)

    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onStop).toHaveBeenCalled()
  })

  it('does not send while busy', async () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} onStop={vi.fn()} isBusy />)
    await userEvent.type(screen.getByLabelText('Message'), 'hello{Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })
})
