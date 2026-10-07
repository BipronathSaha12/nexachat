# Chatbot Backend

Django + DRF backend for the Gemini-powered chatbot described in the PRD.

## Requirements

- Python 3.13+ (developed and tested on 3.14)
- PostgreSQL 16
- Redis 7+

## Quick start

```bash
cd backend
make install                       # creates .venv, installs requirements/dev.txt
cp .env.example .env               # then set GEMINI_API_KEY
createdb chatbot                   # or use ../docker-compose.yml
make migrate
make run                           # http://127.0.0.1:8000
```

`make run` starts **uvicorn**, not `runserver`. The chat endpoint streams, which
requires ASGI; `runserver` will buffer the response and break progressive rendering.

## Commands

| Command | What it does |
|---|---|
| `make run` | ASGI dev server with reload (`PORT=8010 make run` to change port) |
| `make test` | Test suite (no network) |
| `make cover` | Tests with the 75% coverage gate |
| `make integration` | Contract tests against the real Gemini API |
| `make lint` / `make fmt` | Ruff check / auto-fix |
| `make check` | Django system checks plus `--deploy` |
| `make schema` | Regenerate `openapi.yaml` |

## Layout

```
config/          settings (base/dev/prod/test), urls, asgi, wsgi
common/          cross-cutting: errors, logging, middleware, throttling, pagination
users/           custom email-login User, JWT auth endpoints
conversations/   Conversation + Message models, CRUD API
chat/            streaming endpoint, UsageRecord
  services/      gemini.py, prompts.py, context.py, streaming.py, persistence.py
tests/           pytest suite
```

Business logic lives in `chat/services/`. Views validate, authorise and stream;
they never import `google.genai` and never see the API key (PRD 5.3, 14).

## API

Full contract: `openapi.yaml`, or `/api/docs/` while the server runs.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register/` | Returns user + access + refresh |
| POST | `/api/auth/login/` | Same shape as register |
| POST | `/api/auth/logout/` | Blacklists the refresh token |
| POST | `/api/auth/refresh/` | Rotates the refresh token |
| GET | `/api/auth/me/` | Current user |
| GET/POST | `/api/conversations/` | List (cursor paged) / create |
| GET/PATCH/DELETE | `/api/conversations/{id}/` | Retrieve / rename / soft delete |
| GET | `/api/conversations/{id}/messages/` | Paged history |
| POST | `/api/chat/` | **SSE stream** |
| GET | `/healthz/` `/readyz/` | Liveness / readiness |

### Streaming contract

```
event: meta   {"conversation_id","user_message_id","model","request_id",...}
event: delta  {"text":"..."}          repeated
event: done   {"message_id","finish_reason","title","usage":{...}}
event: error  {"code","message","request_id"}
: heartbeat                           idle keepalive
```

Exactly one terminal frame (`done` or `error`) is always sent, so the client can
always leave the streaming state. Errors detected before the response starts come
back as normal JSON with a real status code; errors after streaming has begun arrive
as an `error` frame on a 200, because the status line is already committed.

### Errors

Every non-streaming failure uses one envelope:

```json
{"error": {"code": "rate_limited", "message": "...", "request_id": "..."}}
```

Codes: `validation_error`, `authentication_error`, `permission_denied`, `not_found`,
`rate_limited`, `upstream_error`, `upstream_timeout`, `upstream_rate_limited`,
`context_too_large`, `database_error`, `internal_error`.

## Configuration

All settings come from the environment; see `.env.example`. The ones that matter most:

| Variable | Default | Notes |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.6-flash` | `gemini-2.5-*` is unavailable to new API keys |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.5-flash-lite` | Used after the primary exhausts its retries |
| `GEMINI_THINKING_LEVEL` | `low` | `low`/`high`, or empty for the model default |
| `CONTEXT_MAX_TOKENS` | `32000` | History budget; oldest turns are trimmed first |
| `RATE_LIMIT_CHAT_PER_MINUTE` | `20` | Per user, Redis backed |
| `RATE_LIMIT_CHAT_PER_DAY` | `500` | The real cost ceiling |

`GEMINI_THINKING_BUDGET` is **not** supported by Gemini 3.x models -- sending it
returns HTTP 400. Use `GEMINI_THINKING_LEVEL`.

## Deviation from the PRD

The PRD's example request uses an integer `conversation_id` (`{"conversation_id": 12}`).
This implementation uses UUIDs so conversation identifiers cannot be enumerated. The
request shape is otherwise unchanged.
