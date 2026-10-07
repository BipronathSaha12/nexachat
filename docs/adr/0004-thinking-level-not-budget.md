# ADR 0004: Configure reasoning with thinking_level

**Status:** Accepted · **Date:** 2026-08-23

## Context

The service initially sent `thinking_config.thinking_budget = 0` to disable reasoning
tokens. Every request failed:

```
HTTP 400: Request contains an invalid argument.
```

Verified directly against the API: `thinking_budget` is rejected by both
`gemini-3.6-flash` and `gemini-3.5-flash-lite`, while `thinking_level` ("low"/"high")
is accepted by both. The parameter is valid in the SDK's type system, so nothing
catches this before a live call.

## Decision

Configure reasoning with `GEMINI_THINKING_LEVEL` (`low` by default, empty to use the
model default). Assert the configured model accepts our generation config in
`tests/test_integration_gemini.py`.

## Consequences

- Reasoning cannot be fully disabled on Gemini 3.x flash models; `low` still consumed
  ~94 thinking tokens on a trivial prompt in testing.
- Thinking tokens are billed and never appear in the reply, so they are stored
  separately on `Message` and `UsageRecord` rather than folded into output tokens.
- Changing `GEMINI_MODEL` requires re-running `make integration`; generation
  parameters are not portable across model generations.
