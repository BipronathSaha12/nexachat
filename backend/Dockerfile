# syntax=docker/dockerfile:1

# ---- builder: compile wheels once, keep the runtime image free of build tools ----
FROM python:3.13-slim AS builder

ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements/ requirements/
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements/prod.txt

# ---- runtime ----
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=config.settings.prod

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 app

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=app:app . .

# Collected at build time so the runtime filesystem can stay read-only.
RUN SECRET_KEY=build-only DATABASE_URL=postgres://u:p@localhost/db \
    ALLOWED_HOSTS=localhost GEMINI_API_KEY=build-only \
    python manage.py collectstatic --noinput --settings=config.settings.prod

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT:-8000}/healthz/" || exit 1

# Uvicorn workers under gunicorn: ASGI is required for the streaming endpoint.
# Shell form so $PORT (set by Render, Fly, Cloud Run, ...) is honoured; 8000 locally.
# --timeout must exceed GEMINI_TIMEOUT_SECONDS plus retries or a worker is killed
# mid-stream; --graceful-timeout lets in-flight streams drain on a rolling deploy.
CMD gunicorn config.asgi:application \
      --worker-class uvicorn.workers.UvicornWorker \
      --bind "0.0.0.0:${PORT:-8000}" \
      --workers "${WEB_CONCURRENCY:-4}" \
      --timeout 120 \
      --graceful-timeout 60 \
      --access-logfile - \
      --error-logfile -
