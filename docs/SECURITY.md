# Security

## Controls (PRD 11)

| Control | Implementation |
|---|---|
| Gemini key isolation | Read from the environment in `config/settings/base.py`, used only inside `chat/services/gemini.py`. Never serialised, never logged, never sent to the client. |
| Authentication | JWT (SimpleJWT), 15 min access / 7 day refresh, rotation with blacklist on use |
| Password storage | Argon2 (primary hasher), 10 char minimum plus Django's validators |
| Authorisation | Queryset-level scoping (`Conversation.objects.for_user`). A foreign id yields 404, never 403. |
| Input validation | DRF serializers on every endpoint; 32k char message cap; 256 KB body cap |
| Rate limiting | Redis-backed per-user throttles: per-minute burst and per-day budget |
| CORS | Explicit origin allowlist, credentials enabled, no wildcard |
| CSRF | Enabled globally; the chat endpoint is exempt because it authenticates by bearer token, not cookie |
| SQL injection | ORM only; no raw SQL outside the readiness probe's `SELECT 1` |
| XSS | API returns JSON only; model output is never rendered server side. The client must render Markdown as text, never `dangerouslySetInnerHTML`. |
| Transport | HSTS, SSL redirect, secure cookies in `config/settings/prod.py` |
| Logging | Structured JSON with request id. Message bodies are never logged. |

## Error disclosure

`common/exceptions.py` returns one envelope with a stable code and a safe message.
Upstream provider text is logged server side (`upstream_detail`) and never returned,
so a Gemini error cannot leak prompt content or account details to a client.

DRF's own `default_code` values are deliberately not passed through -- a 401 always
reports `authentication_error`, so the published contract does not shift with a
library upgrade.

## Known gaps

Not implemented; each needs a product decision before launch:

- Email verification and password reset flows (fields exist, delivery does not)
- MFA
- Audit log of authentication events and conversation access
- PII redaction in logs
- Prompt-injection mitigation beyond Gemini's own safety settings
- Account deletion / GDPR export
- Secrets manager integration (production currently reads the environment)

## Reporting

Do not open a public issue for a vulnerability. Contact the maintainers directly.
