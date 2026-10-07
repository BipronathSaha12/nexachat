# ADR 0005: Access tokens in localStorage

**Status:** Accepted · **Date:** 2026-08-23

## Context

PRD 5.1 requires authentication to persist across reloads. With JWT bearer tokens
(ADR 0001) the client has to keep them somewhere.

## Decision

`localStorage`, behind the `tokens` accessor in `src/api/client.js`.

## Rationale

The alternative worth taking seriously is an httpOnly refresh cookie with the access
token held only in memory. That is stronger against XSS, but it reintroduces
everything ADR 0001 avoided: a cross-origin cookie needs `SameSite=None; Secure`, CSRF
protection on every mutating request, and a cookie domain shared between the frontend
and API hosts.

## Consequences

- **XSS in the frontend exposes the tokens.** This is the real cost. It is bounded by
  a 15 minute access lifetime, refresh rotation with server-side blacklisting, and by
  the app never rendering untrusted HTML (see `Markdown.jsx`) — but it is not eliminated.
- Every read and write is wrapped in try/catch: Safari private mode and blocked-storage
  settings throw, and the app must still function (the session just will not persist).
- Moving to httpOnly cookies later touches only `client.js` and the backend's auth
  views; no component reads tokens directly.

## Revisit when

The app handles data where an XSS-driven session theft is unacceptable, or a security
review requires it. At that point implement the refresh-cookie flow and drop this.
