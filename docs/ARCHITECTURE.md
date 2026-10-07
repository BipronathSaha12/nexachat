# Architecture

## Ownership

```
React      user experience
  | HTTPS
Django     application logic + AI orchestration
  |-- PostgreSQL   persistent state
  `-- Gemini       language generation
```

Django is the only process that holds the Gemini API key. React never talks to
Google directly (PRD 5.3, 11).

## Request path for a chat turn

```
POST /api/chat/
  1. RequestIDMiddleware      mint/propagate X-Request-ID
  2. ChatStreamView.post      async, plain Django view (not DRF)
     a. authenticate          JWT bearer -> user
     b. validate              ChatRequestSerializer
     c. throttle              per-minute + per-day, Redis
     d. resolve conversation  user-scoped queryset, or create
     e. build context         system instruction + trimmed history + message
     f. persist user turn     Message(role=user)
  3. StreamingHttpResponse    async generator
     a. emit meta
     b. GeminiService.stream  -> emit delta per chunk, heartbeat when idle
     c. persist assistant turn + UsageRecord
     d. emit done (or error)
```

Steps 1-2 run before any bytes are written, so they can return real HTTP status
codes. Step 3 has already committed `200`, so failures there are delivered in-band
as an `error` frame.

## Why the chat endpoint is not a DRF view

DRF's request/response cycle is synchronous. Under WSGI, a streaming reply occupies
a worker thread for the whole generation -- tens of seconds -- which caps concurrency
at the worker count. The endpoint is therefore a plain async Django view served by
uvicorn, with authentication, validation and throttling applied explicitly. Every
other endpoint stays on DRF, where the framework earns its keep.

## Layers

| Layer | Module | Rule |
|---|---|---|
| HTTP | `*/views.py` | Validate, authorise, serialise. No provider SDKs. |
| Service | `chat/services/` | All Gemini knowledge. Returns domain objects and our own exceptions. |
| Persistence | `chat/services/persistence.py` | `sync_to_async` ORM helpers for the async view. |
| Model | `*/models.py` | Schema plus queryset-level scoping. |

`Conversation.objects.for_user(user)` is the single entry point for reads. Because
another user's row is never in the queryset, there is no object-level permission
check to forget -- and a foreign id returns 404, not 403, so existence does not leak.

## Context management

`chat/services/context.py` assembles the model input. History is walked newest-first
and trimmed against a token budget, then restored to chronological order. This bounds
both cost and the risk of exceeding the context window as conversations grow. Token
estimates are local (≈4 chars/token) and used only for trimming; authoritative counts
come back in Gemini's usage metadata and are stored on `Message` and `UsageRecord`.

## Failure handling

| Condition | Behaviour |
|---|---|
| Retryable upstream error before first token | Exponential backoff with full jitter, up to `GEMINI_MAX_RETRIES` |
| Primary model exhausted | Retry the whole sequence on `GEMINI_FALLBACK_MODEL` |
| Failure after first token | No retry -- the client has already rendered text. Partial output is persisted and an `error` frame is sent. |
| Client disconnect | `CancelledError` -> partial output and a `cancelled` usage row are persisted, upstream connection closed |
| Safety block | `blocked` usage row, `content_blocked` error frame |

## Data model

```
User 1---* Conversation 1---* Message
     `---* UsageRecord *---1 Conversation
```

`UsageRecord` is deliberately separate from `Message`: failed, blocked and cancelled
requests cost money and must be recorded even though they produce no message.

Conversations are soft deleted (`deleted_at`) so history is recoverable and message
rows are not cascaded away.
