"""Operational endpoints. Unauthenticated by design -- load balancers cannot log in."""

import logging

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger("chatbot.health")


def liveness(request):
    """Is the process up? Deliberately checks nothing external."""
    return JsonResponse({"status": "ok"})


def readiness(request):
    """Can this instance actually serve traffic? Checks every hard dependency."""
    checks, healthy = {}, True

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001
        healthy = False
        checks["database"] = "error"
        logger.error("readiness_database_failed", extra={"error": type(exc).__name__})

    try:
        cache.set("healthcheck", "1", timeout=5)
        checks["cache"] = "ok" if cache.get("healthcheck") == "1" else "error"
        healthy = healthy and checks["cache"] == "ok"
    except Exception as exc:  # noqa: BLE001
        healthy = False
        checks["cache"] = "error"
        logger.error("readiness_cache_failed", extra={"error": type(exc).__name__})

    return JsonResponse(
        {"status": "ok" if healthy else "degraded", "checks": checks},
        status=200 if healthy else 503,
    )
