# Chatbot Frontend

React client for the Gemini-powered chatbot. Streams replies, renders Markdown and
highlighted code, and persists the session across reloads.

## Requirements

- Node 20+ (developed on 25)
- The backend running (see `../backend/README.md`)

## Quick start

```bash
cd frontend
npm install
cp .env.example .env          # point VITE_PROXY_TARGET at your backend
npm run dev                   # http://localhost:5173
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with the API proxy |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest suite |
| `npm run cover` | Tests with coverage thresholds |
| `npm run lint` | oxlint |

## Configuration

| Variable | Meaning |
|---|---|
| `VITE_API_BASE_URL` | Absolute backend URL. **Leave empty in dev** so calls go same-origin through the proxy. Set it in production. |
| `VITE_PROXY_TARGET` | Where the dev server forwards `/api`. Defaults to `http://127.0.0.1:8000`. |

Dev uses a same-origin proxy rather than cross-origin calls: no CORS preflight, and
nothing sits between the browser and the SSE stream to buffer it.

## Layout

```
src/
  api/          client.js (fetch + token refresh), auth.js, chat.js (SSE), conversations.js
  auth/         AuthContext.jsx
  hooks/        useChat.js (state machine), useConversations.js
  components/   ChatWindow, Message, ChatInput, Sidebar, ConversationList,
                LoadingIndicator, CodeBlock, Markdown, ErrorBanner, ProtectedRoute
  pages/        Login.jsx, Register.jsx, Chat.jsx
```

## How streaming works

`EventSource` cannot POST or send an `Authorization` header, so `api/chat.js` reads
the SSE stream off `fetch` directly. Frames are separated by a blank line and can be
split across network chunks, so partial frames are buffered rather than parsed eagerly.

Failures arrive two ways, and both are handled:

- **Before the response starts** — a real HTTP status, thrown as `ApiError`. The empty
  assistant bubble is removed.
- **After streaming has begun** — an `error` frame on a 200 response. Text already on
  screen stays; the error appears beneath it.

If the connection drops without a terminal frame, the client raises
`stream_interrupted` rather than treating a truncated reply as complete.

## UI states (PRD 8)

`useChat` exposes `idle → sending → streaming → completed | error`. `sending` covers
the wait before the first token, which is when the thinking indicator shows — real
time-to-first-token against Gemini is around 3 seconds, so an empty bubble would read
as a hang.

## Markdown safety

`Markdown.jsx` renders model output with `react-markdown`, which escapes embedded HTML
by default. **`rehype-raw` is deliberately absent** and must stay absent: adding it
would turn model output into live markup. Nothing in this app uses
`dangerouslySetInnerHTML`. Tests in `src/components/Markdown.test.jsx` assert that
`<script>`, `<img onerror>` and `javascript:` URLs are all inert.

Links from model output open with `rel="noopener noreferrer nofollow"`.

## Accessibility

- Transcript is a `role="log"` with `aria-live="polite"`
- Errors are `role="alert"`
- Every control has a visible focus ring and an accessible name
- Auto-scroll pauses when the user scrolls up, with a "Jump to latest" affordance
- `prefers-reduced-motion` disables the streaming animations
