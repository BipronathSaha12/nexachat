# ADR 0001: JWT over session cookies

**Status:** Accepted · **Date:** 2026-08-23

## Context

The PRD (20) says "Django authentication / JWT" without choosing. The choice changes
the CSRF and CORS design, so it cannot be deferred.

## Decision

SimpleJWT bearer tokens. 15 minute access, 7 day refresh, rotation with blacklist on
use.

## Rationale

The frontend is a separate origin (Vite on :5173, a different host in production).
Session cookies across origins require `SameSite=None; Secure` plus CSRF token
plumbing on every mutating request. Bearer tokens sidestep that and let the chat
endpoint be CSRF-exempt honestly rather than by exception.

## Consequences

- Tokens live in client memory or storage; XSS in the frontend exposes them. Short
  access lifetimes and refresh rotation bound the damage.
- Logout requires server-side blacklisting, which we do -- see `LogoutView`.
- `rest_framework_simplejwt.token_blacklist` adds two tables and a row per issued
  refresh token. Prune periodically at scale.
