# Deployment

Frontend on Vercel, backend on a VPS. The two halves deploy independently.

| Piece | Where | URL |
|---|---|---|
| Frontend | Vercel (auto-deploys from `main`, root dir `frontend/`) | https://chatbot.technicalbind.com |
| Backend + DB | VPS `72.62.124.221` | https://chatbot.devtechguru.cloud |

## Why the backend is not containerised

The VPS is a shared CloudPanel host already running several production sites
(nginx on :80/:443, four PHP-FPM versions, Varnish, MySQL, PostgreSQL, Redis, and
other Python apps on 8001/8010/8011/8012). Installing Docker there would add
iptables rules to a live box for no benefit. This deployment instead follows the
conventions already on the host:

- systemd unit running gunicorn with uvicorn workers on `127.0.0.1:8020`
- a CloudPanel nginx vhost in front, terminating TLS
- the host's existing PostgreSQL (dedicated `chatbot` database and role)
- the host's existing Redis, on **db 9** — db 6 belongs to another app

ASGI is not optional: the chat endpoint streams, and a sync worker would hold a
thread for the whole generation.

## Layout on the server

```
/home/chatbot/app                  git checkout (public repo, no deploy key needed)
/home/chatbot/app/.env             secrets, 0600, owned by chatbot
/home/chatbot/app/.venv            virtualenv
/home/chatbot/logs/                gunicorn + nginx logs
/etc/systemd/system/chatbot-backend.service
/etc/nginx/sites-enabled/chatbot.devtechguru.cloud.conf
/usr/local/bin/chatbot-deploy      deploy/deploy.sh, invoked by CI
```

## The nginx setting that matters

CloudPanel's generated reverse-proxy vhost buffers responses into 256k blocks.
For a normal app that is fine; for this one it holds the SSE stream until a buffer
fills, so the reply arrives in one lump and progressive rendering is destroyed.
`deploy/nginx-chatbot.devtechguru.cloud.conf` sets:

```nginx
proxy_buffering off;
proxy_request_buffering off;
proxy_set_header Connection "";   # SSE, not websockets
proxy_read_timeout 300;
```

If CloudPanel ever regenerates that vhost, re-apply this file or streaming breaks.

## CI/CD

`.github/workflows/ci.yml` runs backend and frontend tests on every push and PR.
On a push to `main` that passes, `deploy-backend` SSHes to the VPS and runs
`/usr/local/bin/chatbot-deploy`, which fetches, installs, runs `check --deploy`,
migrates, collects static, restarts the service, then polls `/readyz/` and dumps
the journal if it never comes up.

Secrets live on the `production` GitHub Environment:

| Secret | Value |
|---|---|
| `VPS_HOST` | `72.62.124.221` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | private half of a dedicated ed25519 deploy key |
| `VPS_KNOWN_HOSTS` | pinned host key, so CI never trusts an unknown server |

The frontend does not go through Actions: the Vercel project is linked to this
repo and builds `frontend/` itself on every push to `main`.

## Manual deploy

```bash
ssh root@72.62.124.221 /usr/local/bin/chatbot-deploy
```

## Rollback

```bash
ssh root@72.62.124.221 /usr/local/bin/chatbot-deploy origin/<previous-sha>
```

Migrations are additive; no destructive operation has shipped, so rolling the code
back does not require touching the schema.

## Certificates

CloudPanel issues Let's Encrypt certificates once DNS resolves:

```bash
ssh root@72.62.124.221 \
  "clpctl lets-encrypt:install:certificate --domainName=chatbot.devtechguru.cloud"
```

This requires an `A` record for `chatbot.devtechguru.cloud` pointing at
`72.62.124.221`. Until then the vhost serves CloudPanel's self-signed placeholder
and browsers will refuse the connection.

## Operational notes

- The backend redirects plain HTTP to HTTPS (`SECURE_SSL_REDIRECT`), so a health
  probe against `http://127.0.0.1:8020` returns 301. Probe with
  `-H 'X-Forwarded-Proto: https'`, which is what nginx sends.
- gunicorn `--timeout 120` must stay above `GEMINI_TIMEOUT_SECONDS` (60) plus
  retries, or a worker is killed mid-stream.
- No `--max-requests`: recycling a worker while a reply is streaming would
  truncate it.
