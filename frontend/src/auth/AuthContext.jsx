import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import * as authApi from '../api/auth'
import { tokens } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Seed from storage so a reload does not flash the login screen (PRD 5.1).
  const [user, setUser] = useState(() => tokens.user)
  const [bootstrapping, setBootstrapping] = useState(() => Boolean(tokens.access))

  useEffect(() => {
    // `bootstrapping` is seeded false when there is no token, so there is nothing to do.
    if (!tokens.access) return undefined

    let cancelled = false
    // A stored token may have been revoked or expired; confirm it before trusting it.
    authApi
      .me()
      .then((fresh) => {
        if (!cancelled) setUser(fresh)
      })
      .catch(() => {
        if (!cancelled) {
          tokens.clear()
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const nextUser = await authApi.login(credentials)
    setUser(nextUser)
    return nextUser
  }, [])

  const register = useCallback(async (details) => {
    const nextUser = await authApi.register(details)
    setUser(nextUser)
    return nextUser
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, bootstrapping, isAuthenticated: Boolean(user), login, register, logout }),
    [user, bootstrapping, login, register, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
