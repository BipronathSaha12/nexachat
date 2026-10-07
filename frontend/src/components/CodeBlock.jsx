import { useEffect, useMemo, useRef, useState } from 'react'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff'
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go'
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx'
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark'

import { CheckIcon, CopyIcon } from './icons'

// PrismLight with an explicit language list: the full build pulls in ~300 grammars.
const LANGUAGES = {
  bash, css, diff, go, java, javascript, json, jsx, markup, python, rust, sql, tsx, typescript, yaml,
}
for (const [name, definition] of Object.entries(LANGUAGES)) {
  SyntaxHighlighter.registerLanguage(name, definition)
}

const ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  html: 'markup',
  xml: 'markup',
  yml: 'yaml',
  golang: 'go',
  rs: 'rust',
  postgres: 'sql',
  psql: 'sql',
}

export function resolveLanguage(raw) {
  if (!raw) return null
  const name = String(raw).toLowerCase()
  const resolved = ALIASES[name] ?? name
  return resolved in LANGUAGES ? resolved : null
}

export default function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false)
  const [scrolls, setScrolls] = useState(false)
  const scrollRef = useRef(null)
  const resolved = useMemo(() => resolveLanguage(language), [language])

  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  // Long lines scroll inside the block. Without a visible cue nobody discovers
  // that, so the fade only appears when there is actually more to the right.
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return undefined
    const measure = () => setScrolls(element.scrollWidth > element.clientWidth + 4)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [code])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false) // clipboard blocked (insecure context or denied permission)
    }
  }

  return (
    <figure className="my-3.5 overflow-hidden rounded-xl border border-code-line bg-code-bg">
      <figcaption className="flex items-center justify-between border-b border-code-line bg-code-head px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-wide text-code-ink">
          {language || 'text'}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-code-ink transition hover:bg-code-line hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {copied ? <CheckIcon width={13} height={13} /> : <CopyIcon width={13} height={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>

      <div className="relative">
        <div ref={scrollRef} className="overflow-x-auto">
          <SyntaxHighlighter
            language={resolved ?? 'text'}
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: '0.9rem 1rem',
              background: 'transparent',
              fontSize: '0.8125rem',
              lineHeight: 1.65,
            }}
            codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}
            PreTag="div"
          >
            {code}
          </SyntaxHighlighter>
        </div>
        {scrolls && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-code-bg to-transparent"
          />
        )}
      </div>
    </figure>
  )
}
