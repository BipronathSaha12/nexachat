import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../api/client'
import ChatWindow from './ChatWindow'

const messages = [
  { id: 'u1', role: 'user', content: 'What is a hook?' },
  { id: 'a1', role: 'assistant', content: 'A **hook** is a function.' },
]

describe('ChatWindow', () => {
  it('prompts the user when there is nothing to show', () => {
    render(<ChatWindow messages={[]} error={null} />)
    expect(screen.getByRole('heading', { name: /what can i help you with/i })).toBeInTheDocument()
  })

  it('exposes the transcript as a live log', () => {
    render(<ChatWindow messages={messages} error={null} />)
    const log = screen.getByRole('log', { name: 'Conversation' })
    expect(log).toHaveAttribute('aria-live', 'polite')
  })

  it('renders user text literally and assistant text as Markdown', () => {
    render(<ChatWindow messages={messages} error={null} />)
    expect(screen.getByText('What is a hook?')).toBeInTheDocument()
    expect(screen.getByText('hook').tagName).toBe('STRONG')
  })

  it('shows a thinking indicator for an assistant turn with no text yet', () => {
    render(
      <ChatWindow messages={[{ id: 'a', role: 'assistant', content: '', streaming: true }]} error={null} />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Thinking')
  })

  it('notes when a reply was stopped', () => {
    render(
      <ChatWindow messages={[{ id: 'a', role: 'assistant', content: 'partial', stopped: true }]} error={null} />,
    )
    expect(screen.getByText('Stopped.')).toBeInTheDocument()
  })

  it('shows an error beneath the transcript without hiding it', () => {
    render(
      <ChatWindow
        messages={messages}
        error={new ApiError({ code: 'upstream_error', message: 'The AI service failed', status: 502 })}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('The AI service failed')
    expect(screen.getByText('What is a hook?')).toBeInTheDocument()
  })
})
