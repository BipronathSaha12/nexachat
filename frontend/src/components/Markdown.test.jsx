import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Markdown from './Markdown'

describe('Markdown rendering (PRD 7)', () => {
  it('renders headings, emphasis, lists, links and blockquotes', () => {
    render(
      <Markdown>{`# Title\n\n**bold** and *italic*\n\n- one\n- two\n\n> quoted\n\n[link](https://example.com)`}</Markdown>,
    )
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument()
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('italic').tagName).toBe('EM')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('quoted')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'link' })).toHaveAttribute('href', 'https://example.com')
  })

  it('renders GFM tables inside a horizontally scrollable container', () => {
    const { container } = render(
      <Markdown>{`| a | b |\n| - | - |\n| 1 | 2 |`}</Markdown>,
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(container.querySelector('.overflow-x-auto')).toBeTruthy()
  })

  it('opens external links safely', () => {
    render(<Markdown>{'[x](https://example.com)'}</Markdown>)
    const link = screen.getByRole('link', { name: 'x' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('renders inline code without the code-block chrome', () => {
    render(<Markdown>{'use `useState` here'}</Markdown>)
    const code = screen.getByText('useState')
    expect(code.tagName).toBe('CODE')
    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument()
  })
})

describe('Markdown security', () => {
  it('escapes raw HTML in model output instead of rendering it', () => {
    const { container } = render(
      <Markdown>{'<script>window.pwned = true</script><img src=x onerror="window.pwned=true">'}</Markdown>,
    )
    // No live markup: the tags must not exist as elements.
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(window.pwned).toBeUndefined()
    // The text itself is still shown to the user.
    expect(container.textContent).toContain('<script>')
  })

  it('does not render an HTML anchor smuggled through Markdown', () => {
    const { container } = render(
      <Markdown>{'<a href="javascript:alert(1)">click</a>'}</Markdown>,
    )
    expect(container.querySelector('a')).toBeNull()
  })

  it('drops a javascript: URL from a Markdown link', () => {
    render(<Markdown>{'[click](javascript:alert(1))'}</Markdown>)
    const link = screen.queryByRole('link', { name: 'click' })
    // react-markdown sanitises the protocol; the href must not be executable.
    expect(link?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
  })
})

describe('Code blocks (PRD 7)', () => {
  const fenced = '```python\nprint("hello")\n```'

  it('renders a fenced block with its language label', () => {
    render(<Markdown>{fenced}</Markdown>)
    expect(screen.getByText('python')).toBeInTheDocument()
    expect(screen.getByText(/print/)).toBeInTheDocument()
  })

  it('copies the code and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    render(<Markdown>{fenced}</Markdown>)
    await userEvent.click(screen.getByRole('button', { name: /copy code/i }))

    expect(writeText).toHaveBeenCalledWith('print("hello")')
    expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument()
  })

  it('stays usable when the clipboard is blocked', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })

    render(<Markdown>{fenced}</Markdown>)
    await userEvent.click(screen.getByRole('button', { name: /copy code/i }))
    // No crash, and the button does not falsely claim success.
    expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument()
  })

  it('puts wide code in its own scroll container', () => {
    const { container } = render(<Markdown>{'```js\nconst x = 1\n```'}</Markdown>)
    expect(container.querySelector('.overflow-x-auto')).toBeTruthy()
  })

  it('falls back to plain rendering for an unknown language', () => {
    render(<Markdown>{'```brainfuck\n+++\n```'}</Markdown>)
    expect(screen.getByText('brainfuck')).toBeInTheDocument()
  })
})
