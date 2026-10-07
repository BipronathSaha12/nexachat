# Runbook

## Health

| Endpoint | Meaning | Use for |
|---|---|---|
| `GET /healthz/` | Process is up. Checks nothing external. | Liveness probe |
| `GET /readyz/` | Postgres and Redis both reachable. Returns 503 when degraded. | Readiness probe, load balancer |

## Diagnosing a failed chat request

Every response carries `X-Request-ID`, and it appears in the SSE `meta` and `error`
frames. Search logs by it:

```bash
grep '"request_id":"<id>"' app.log
```

Relevant log events:

| Event | Meaning |
|---|---|
| `gemini_retry` | Transient upstream error; includes `status` and `upstream_detail` |
| `gemini_request_rejected` | Non-retryable upstream rejection, usually a bad request parameter |
| `gemini_model_exhausted` | Primary model gave up; falling back |
| `gemini_stream_broken_midstream` | Failed after bytes were sent; partial reply was saved |
| `chat_stream_cancelled` | Client disconnected |
| `context_trimmed` | History exceeded the budget; oldest turns dropped |

## Common incidents

### All chat requests return `upstream_error`

Check `upstream_detail` in the logs first -- it carries Google's own message.

Most likely causes, in order:

1. **A generation parameter the model rejects.** Gemini 3.x returns HTTP 400 for
   `thinking_budget`; use `GEMINI_THINKING_LEVEL`. Confirm with `make integration`.
2. **Model retired.** `gemini-2.5-*` is unavailable to new API keys and 404s with a
   message naming its replacement. Update `GEMINI_MODEL`.
3. **Invalid or revoked API key.** Verify:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     -H "x-goog-api-key: $GEMINI_API_KEY" \
     https://generativelanguage.googleapis.com/v1beta/models
   ```
   200 means the key is good.

### `upstream_rate_limited` spikes

Google is throttling the project, not us. Check the quota in AI Studio. Short term,
lower `RATE_LIMIT_CHAT_PER_MINUTE` so our own throttle absorbs the pressure and users
get a clean 429 with `Retry-After` instead of an upstream failure.

### Cost is climbing

```sql
SELECT model,
       date_trunc('day', created_at) AS day,
       count(*)               AS requests,
       sum(input_tokens)      AS input,
       sum(output_tokens)     AS output,
       sum(thinking_tokens)   AS thinking
FROM chat_usage_record
GROUP BY 1, 2 ORDER BY 2 DESC;
```

`thinking_tokens` is often the largest column and is easy to miss -- it is billed and
invisible in the reply. Lower `GEMINI_THINKING_LEVEL` to `low`, or switch
`GEMINI_MODEL` to a lite model, before touching rate limits.

Per-user offenders:

```sql
SELECT user_id, count(*), sum(input_tokens + output_tokens + thinking_tokens) AS tokens
FROM chat_usage_record
WHERE created_at > now() - interval '1 day'
GROUP BY 1 ORDER BY 3 DESC LIMIT 20;
```

### Streams hang or truncate behind a proxy

The response sets `X-Accel-Buffering: no` and `Cache-Control: no-transform`, and
sends `: heartbeat` every `STREAM_HEARTBEAT_SECONDS`. If a proxy still buffers,
confirm it is not gzipping `text/event-stream` and that its read timeout exceeds
the heartbeat interval.

### `readyz` reports `database: error`

Check connection count against `max_connections`. `DB_CONN_MAX_AGE=60` means each
worker holds a connection for a minute; `workers x threads` must stay below the
server limit, allowing for a rolling deploy running two versions at once.

### High latency, no errors

`first_token_ms` in `UsageRecord` separates model thinking time from network time:

```sql
SELECT model,
       percentile_cont(0.5)  WITHIN GROUP (ORDER BY first_token_ms) AS p50_ttft,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY first_token_ms) AS p95_ttft,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)     AS p95_total
FROM chat_usage_record
WHERE outcome = 'success' AND created_at > now() - interval '1 hour'
GROUP BY 1;
```

A high `p95_ttft` with normal total latency means the model is thinking, not that the
network is slow. Lower `GEMINI_THINKING_LEVEL`.

## Rollback

Migrations are additive; no destructive operations have shipped. Deploy the previous
image and leave the schema in place. If a migration must be reversed:

```bash
python manage.py migrate <app> <previous_migration>
```
