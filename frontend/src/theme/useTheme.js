import { useCallback, useEffect, useState } from 'react'

const KEY = 'chatbot.theme'
const ORDER = ['system', 'light', 'dark']

function read() {
  try {
    const stored = localStorage.getItem(KEY)
    return ORDER.includes(stored) ? stored : 'system'
  } catch {
    return 'system' // storage blocked; follow the OS
  }
}

function apply(theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

/** Three-state theme: follow the OS, or override it in either direction. */
export function useTheme() {
  const [theme, setTheme] = useState(read)

  useEffect(() => {
    apply(theme)
    try {
      if (theme === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, theme)
    } catch {
      /* preference simply will not persist */
    }
  }, [theme])

  const cycle = useCallback(() => {
    setTheme((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])
  }, [])

  return { theme, setTheme, cycle }
}

// Applied before React mounts so there is no flash of the wrong palette.
export function applyStoredTheme() {
  apply(read())
}
