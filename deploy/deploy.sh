#!/usr/bin/env bash
# Deploy the backend on the VPS. Run as root; invoked by CI over SSH.
#
# Idempotent and safe to re-run. Migrations run before the restart so the new
# code never sees an old schema.
set -euo pipefail

APP_DIR=/home/chatbot/app
APP_USER=chatbot
SERVICE=chatbot-backend
REF="${1:-origin/main}"

run_as_app() {
  sudo -u "$APP_USER" env $(grep -v '^#' "$APP_DIR/.env" | grep -v '^$' | xargs -d '\n') "$@"
}

echo "==> fetching $REF"
cd "$APP_DIR"
git fetch --depth 1 origin main
git reset --hard "$REF"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> installing dependencies"
sudo -u "$APP_USER" "$APP_DIR/.venv/bin/python" -m pip install -q -r "$APP_DIR/backend/requirements/prod.txt"

cd "$APP_DIR/backend"

echo "==> django checks"
run_as_app "$APP_DIR/.venv/bin/python" manage.py check --deploy

echo "==> migrating"
run_as_app "$APP_DIR/.venv/bin/python" manage.py migrate --noinput

echo "==> collecting static"
run_as_app "$APP_DIR/.venv/bin/python" manage.py collectstatic --noinput

echo "==> restarting $SERVICE"
systemctl restart "$SERVICE"

echo "==> waiting for health"
for i in $(seq 1 30); do
  if curl -fsS --max-time 5 -H 'X-Forwarded-Proto: https' -H 'Host: chatbot.devtechguru.cloud' \
       http://127.0.0.1:8020/readyz/ >/dev/null 2>&1; then
    echo "==> healthy after ${i}s"
    curl -s -H 'X-Forwarded-Proto: https' -H 'Host: chatbot.devtechguru.cloud' http://127.0.0.1:8020/readyz/
    echo
    exit 0
  fi
  sleep 1
done

echo "==> FAILED to become healthy; last 40 log lines:" >&2
journalctl -u "$SERVICE" -n 40 --no-pager >&2
exit 1
