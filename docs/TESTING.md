# Testing

```bash
make test          # default suite, no network
make cover         # with the 75% coverage gate
make integration   # contract tests against the real Gemini API
```

## Layers

| File | Covers |
|---|---|
| `tests/test_auth.py` | Registration, login, logout/blacklist, `me`, password policy |
| `tests/test_conversations.py` | CRUD, ownership isolation, soft delete, pagination |
| `tests/test_context.py` | History assembly, role mapping, token and message trimming |
| `tests/test_gemini_service.py` | Retries, fallback, error translation, thought filtering, safety blocks |
| `tests/test_chat_stream.py` | The endpoint end to end with the service stubbed |
| `tests/test_integration_gemini.py` | Live API contract (opt in) |

## Why the integration tests exist

The unit suite stubs the SDK, so it cannot catch a parameter the *model* rejects.
That is not hypothetical: `thinking_budget` is valid in the SDK's type system and
returns HTTP 400 from every Gemini 3.x model. `make integration` asserts that the
configured model and the fallback both accept the generation config we actually send,
that streaming arrives in more than one chunk, and that title generation returns a
usable string.

Run it after changing `GEMINI_MODEL`, `GEMINI_THINKING_LEVEL`, or anything in
`_generation_config`.

## Gotchas

- `StreamingHttpResponse` from an async view exposes an **async** iterator.
  `b"".join(response.streaming_content)` raises `TypeError`; use the `collect()`
  helper in `tests/test_chat_stream.py`.
- The response body is lazy. Nothing is persisted until the stream is consumed, so a
  test that asserts on saved rows must drain it first.
- Chat tests use `django_db(transaction=True)` because the async view crosses threads
  via `sync_to_async`.
- Throttles are disabled in `config/settings/test.py` and exercised deliberately.
