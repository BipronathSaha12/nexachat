import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, bootstrapping } = useAuth()
  const location = useLocation()

  // Wait for the stored token to be verified; redirecting first would bounce a
  // signed-in user to the login screen on every reload.
  if (bootstrapping) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas" role="status">
        <span className="animate-shimmer text-sm text-ink-faint">Loading…</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
