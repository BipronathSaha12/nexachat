# NexaChat

Web chatbot built on Google Gemini: streaming replies, Markdown and syntax-highlighted
code, persistent per-user conversations.

React + Tailwind · Django + DRF · PostgreSQL · Redis · Google Gemini

Built to the spec in `LLM_Powered_AI_Chatbot_PRD.pdf`.

**Live:** <https://llm-powered-ai-chatbot-tausifs-projects.vercel.app>

The frontend is deployed. The backend is not yet — sign-in will fail until it is.
`render.yaml` is a one-click blueprint; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## What it does

- Register, sign in, sign out; the session survives a reload
- Start a conversation, send a message, watch the reply stream in token by token
- Follow-up questions keep their context
- Replies render Markdown: headings, lists, tables, links, and fenced code with
  syntax highlighting and a copy button
- Conversations are listed, renamed, switched and deleted from a sidebar
- Every failure mode has a real message and, where it makes sense, a retry

## Repository layout

```
backend/    Django + DRF API, Gemini service layer, streaming endpoint
frontend/   React SPA
docs/       architecture, security, runbook, deployment, testing, ADRs
render.yaml Render blueprint for the backend
```

Start with [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).

## Run it locally

Needs Python 3.13+, Node 20+, PostgreSQL 16, Redis 7.

```bash
# 1. Backend
cd backend
make install
cp .env.example .env          # set GEMINI_API_KEY (get one at aistudio.google.com/apikey)
createdb chatbot
make migrate
make run                      # http://127.0.0.1:8000

# 2. Frontend, in a second terminal
cd frontend
npm install
cp .env.example .env
npm run dev                   # http://localhost:5173
```

`make run` starts uvicorn rather than `runserver`: the chat endpoint streams, and
that needs ASGI.

Docker alternative: `docker compose up` from the repo root.

## Architecture

```
React  ──HTTPS──▶  Django  ──▶  PostgreSQL
                      └────────▶  Gemini
```

The Gemini API key never leaves the server. React talks only to Django.

`POST /api/chat/` streams Server-Sent Events:

```
event: meta   {"conversation_id","user_message_id","model","request_id",...}
event: delta  {"text":"..."}          repeated as the model produces output
event: done   {"message_id","finish_reason","title","usage":{...}}
event: error  {"code","message","request_id"}
```

Full API contract: `backend/openapi.yaml`, or `/api/docs/` with the server running.

Design decisions and their tradeoffs are recorded in [docs/adr/](docs/adr/).

## Tests

```bash
cd backend  && make test         # 61 tests
cd backend  && make integration  # contract tests against the real Gemini API
cd frontend && npm test          # 91 tests
```

The integration tests exist because the unit suite stubs the SDK and so cannot catch
a parameter the *model* rejects. That is not hypothetical — see
[ADR 0004](docs/adr/0004-thinking-level-not-budget.md).

## Deployment

Frontend on Vercel, backend on Render. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Vercel does not host the backend: the chat endpoint holds a connection open for the
length of a generation, and it depends on Redis and a persistent Postgres connection.
Serverless functions are the wrong shape for that.

## Security

The API key is server-side only. Model output is escaped, never rendered as HTML.
Users can only reach their own conversations, and a foreign id returns 404 rather
than 403 so existence does not leak. Details and known gaps:
[docs/SECURITY.md](docs/SECURITY.md).

## Note on macOS iCloud sync

If you clone this into an iCloud-synced folder (`~/Desktop` or `~/Documents` with
"Desktop & Documents Folders" enabled), `node_modules` and `.venv` will be indexed by
`fileproviderd` and the test suites will stall or time out. Clone somewhere else.
