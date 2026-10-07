import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import CodeBlock from './CodeBlock'

/**
 * Renders model output as Markdown (PRD 7).
 *
 * SECURITY: `rehype-raw` is deliberately absent. react-markdown escapes embedded HTML
 * by default, so model output can never become live markup. Do not add a raw-HTML
 * plugin here, and never render this content with dangerouslySetInnerHTML.
 */

function extractText(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node.props?.children !== undefined) return extractText(node.props.children)
  return ''
}

const components = {
  code({ inline, className, children, ...props }) {
    const language = /language-([\w-]+)/.exec(className || '')?.[1]
    const text = extractText(children).replace(/\n$/, '')

    // react-markdown v10 stopped passing `inline`; a fenced block always has a
    // language class or a newline, which is enough to tell the two apart.
    const isBlock = inline === false || Boolean(language) || text.includes('\n')

    if (!isBlock) {
      return (
        <code
          className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-mono text-[0.85em] text-ink"
          {...props}
        >
          {children}
        </code>
      )
    }
    return <CodeBlock code={text} language={language} />
  },

  pre({ children }) {
    // CodeBlock renders its own container; a nested <pre> would double the padding.
    return <>{children}</>
  },

  a({ children, href, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        // noopener/noreferrer: model output can contain arbitrary links.
        rel="noopener noreferrer nofollow"
        className="text-accent underline decoration-accent/35 underline-offset-[3px] transition hover:decoration-accent"
        {...props}
      >
        {children}
      </a>
    )
  },

  table({ children, ...props }) {
    return (
      <div className="my-3.5 overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-[13.5px]" {...props}>
          {children}
        </table>
      </div>
    )
  },
  thead: ({ children, ...props }) => (
    <thead className="bg-raised" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th
      // No uppercase transform: model tables carry meaningful casing, and it
      // mangles inline code inside a header cell.
      className="border-b border-line px-3 py-2 text-left text-[13px] font-semibold text-ink"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-b border-line px-3 py-2 align-top last:border-0" {...props}>
      {children}
    </td>
  ),

  h1: ({ children }) => <h1 className="mt-5 mb-2 text-lg font-semibold tracking-tight first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-5 mb-2 text-base font-semibold tracking-tight first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-4 mb-1.5 text-[15px] font-semibold first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="my-2.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2.5 list-disc space-y-1.5 pl-5 marker:text-ink-faint">{children}</ul>,
  ol: ({ children }) => <ol className="my-2.5 list-decimal space-y-1.5 pl-5 marker:text-ink-faint">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-3.5 border-l-2 border-line-strong py-0.5 pl-4 text-ink-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-line" />,
}

function Markdown({ children }) {
  // 15px/1.75 at a bounded measure: long answers are read, not scanned.
  return (
    <div className="min-w-0 text-[15px] leading-7 break-words text-ink">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

export default memo(Markdown)
