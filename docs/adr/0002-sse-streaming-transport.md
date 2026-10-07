# ADR 0002: Server-Sent Events for streaming

**Status:** Accepted · **Date:** 2026-08-23

## Context

PRD 6 requires progressive rendering. The transport was unspecified.

## Decision

Server-Sent Events over the existing HTTP POST, framed as typed events
(`meta`/`delta`/`done`/`error`) with `: heartbeat` comments during idle gaps.

## Alternatives

- **WebSockets** — bidirectional, which we do not need. Costs a second protocol,
  Django Channels, a Redis channel layer, and separate auth and scaling stories.
- **Chunked plain text** — simplest, but no way to carry structured terminal
  information (message id, usage, finish reason) or to distinguish a completed reply
  from a truncated connection.

## Consequences

- Errors after the first byte cannot use an HTTP status code; they are `error` frames
  on a 200. Clients must treat the terminal frame as authoritative, not the status.
- Requires ASGI. `runserver` and any buffering proxy will break progressive rendering.
- Heartbeats keep proxies from closing a connection while the model is thinking --
  a real risk given observed time-to-first-token of ~3s and thinking budgets above it.
