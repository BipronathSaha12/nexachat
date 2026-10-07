import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import AuthShell, { Field, inputClass, submitClass } from '../components/AuthShell'
import DemoCredentials from '../components/DemoCredentials'
import ErrorBanner from '../components/ErrorBanner'

export default function Login() {
  const { login, isAuthenticated, bootstrapping } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (!bootstrapping && isAuthenticated) {
    return <Navigate to={location.state?.from?.pathname || '/'} replace />
  }

  async function signIn(credentials) {
    setSubmitting(true)
    setError(null)
    try {
      await login(credentials)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (loginError) {
      setError(loginError)
    } finally {
      setSubmitting(false)
    }
  }

  function onSubmit(event) {
    event.preventDefault()
    return signIn({ email, password })
  }

  // Fill the fields as well as submitting, so the user can see what was used.
  function useDemo(credentials) {
    setEmail(credentials.email)
    setPassword(credentials.password)
    return signIn(credentials)
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Continue to your conversations."
      footer={
        <>
          No account?{' '}
          <Link
            to="/register"
            className="font-medium text-accent underline decoration-accent/35 underline-offset-[3px] hover:decoration-accent"
          >
            Create one
          </Link>
        </>
      }
    >
      <div className="mt-6">
        <DemoCredentials onUse={useDemo} disabled={submitting} />
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <Field id="email" label="Email">
          <input
            id="email"
            type="email"
            value={email}
            required
            autoComplete="email"
            placeholder="you@example.com"
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field id="password" label="Password">
          <input
            id="password"
            type="password"
            value={password}
            required
            autoComplete="current-password"
            placeholder="••••••••••"
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </Field>

        <button type="submit" disabled={submitting} className={submitClass}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}
