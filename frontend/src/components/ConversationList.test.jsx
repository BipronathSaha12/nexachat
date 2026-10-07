import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ConversationList from './ConversationList'

const conversations = [
  { id: 'c1', title: 'First thread', message_count: 4 },
  { id: 'c2', title: 'Second thread', message_count: 0 },
]

function setup(overrides = {}) {
  const props = {
    conversations,
    activeId: 'c1',
    loading: false,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
  render(<ConversationList {...props} />)
  return props
}

describe('ConversationList', () => {
  it('shows a skeleton while loading', () => {
    const { container } = render(<ConversationList conversations={[]} loading />)
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
  })

  it('invites the user to start one when the list is empty', () => {
    render(<ConversationList conversations={[]} loading={false} />)
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument()
  })

  it('marks the active conversation for assistive technology', () => {
    setup()
    expect(screen.getByRole('button', { name: 'First thread' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Second thread' })).not.toHaveAttribute('aria-current')
  })

  it('selects a conversation on click', async () => {
    const { onSelect } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Second thread' }))
    expect(onSelect).toHaveBeenCalledWith('c2')
  })

  it('renames on Enter', async () => {
    const { onRename } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Rename First thread' }))

    const input = screen.getByLabelText('Conversation title')
    await userEvent.clear(input)
    await userEvent.type(input, 'Renamed{Enter}')

    expect(onRename).toHaveBeenCalledWith('c1', 'Renamed')
  })

  it('abandons a rename on Escape', async () => {
    const { onRename } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Rename First thread' }))

    const input = screen.getByLabelText('Conversation title')
    await userEvent.clear(input)
    await userEvent.type(input, 'Discarded{Escape}')

    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'First thread' })).toBeInTheDocument()
  })

  it('ignores a rename to a blank title', async () => {
    const { onRename } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Rename First thread' }))

    const input = screen.getByLabelText('Conversation title')
    await userEvent.clear(input)
    await userEvent.type(input, '   {Enter}')

    expect(onRename).not.toHaveBeenCalled()
  })

  it('requires a second click to delete', async () => {
    const { onDelete } = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Delete First thread' }))
    expect(onDelete).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /Confirm delete First thread/ }))
    expect(onDelete).toHaveBeenCalledWith('c1')
  })
})
