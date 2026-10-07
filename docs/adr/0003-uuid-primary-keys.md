# ADR 0003: UUID primary keys

**Status:** Accepted · **Date:** 2026-08-23

## Context

PRD 10 shows `{"conversation_id": 12}` -- a sequential integer.

## Decision

UUIDv4 primary keys on `User`, `Conversation`, `Message` and `UsageRecord`.

## Rationale

Conversation ids appear in URLs and request bodies. Sequential integers let anyone
enumerate the id space and measure total volume, and turn every authorisation check
into the only thing standing between a guessed id and someone else's data. Our
scoping is correct, but defence in depth is cheap here.

## Consequences

- Deviates from the PRD example. The request shape is otherwise unchanged.
- UUID indexes are wider than bigints and not insertion-ordered. At current scale this
  is immaterial; `Conversation` is queried by `(user, -updated_at)` and `Message` by
  `(conversation, created_at)`, both covered by explicit indexes.
