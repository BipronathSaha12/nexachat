import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import AuthShell, { Field, inputClass, submitClass } from '../components/AuthShell'
import ErrorBanner from '../components/ErrorBanner'

export default function Register() {
  const { register, isAuthenticated, bootstrapping } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', displayName: '', password: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (!bootstrapping && isAuthenticated) return <Navigate to="/" replace />

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value })
  // Field-level messages from the server (password policy, duplicate email).
  const fieldErrors = error?.fieldErrors ?? {}

  async function onSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await register(form)
      navigate('/', { replace: true })
    } catch (registerError) {
      setError(registerError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create an account"
      subtitle="Your conversations stay private to you."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-accent underline decoration-accent/35 underline-offset-[3px] hover:decoration-accent"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {!Object.keys(fieldErrors).length && (
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
        )}

        <Field id="email" label="Email" error={fieldErrors.email}>
          <input
            id="email"
            type="email"
            value={form.email}
            required
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
            onChange={update('email')}
            className={inputClass}
          />
        </Field>

        <Field id="displayName" label="Display name">
          <input
            id="displayName"
            type="text"
            value={form.displayName}
            autoComplete="nickname"
            placeholder="Optional"
            onChange={update('displayName')}
            className={inputClass}
          />
        </Field>

        <Field
          id="password"
          label="Password"
          hint="At least 10 characters."
          error={fieldErrors.password}
        >
          <input
            id="password"
            type="password"
            value={form.password}
            required
            autoComplete="new-password"
            placeholder="••••••••••"
            aria-invalid={Boolean(fieldErrors.password)}
            onChange={update('password')}
            className={inputClass}
          />
        </Field>

        <button type="submit" disabled={submitting} className={submitClass}>
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
