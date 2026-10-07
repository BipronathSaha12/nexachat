"""Request id propagation and access logging."""

import logging
import time
import uuid

from common.context import request_id_var, user_id_var

logger = logging.getLogger("chatbot.access")

REQUEST_ID_HEADER = "HTTP_X_REQUEST_ID"


class RequestIDMiddleware:
    """Accept an inbound X-Request-ID or mint one, then echo it back."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.META.get(REQUEST_ID_HEADER, "")
        # Never trust an unbounded client-supplied value into our logs.
        request_id = incoming[:64] if incoming.isascii() and 0 < len(incoming) <= 64 else uuid.uuid4().hex
        request.request_id = request_id
        token = request_id_var.set(request_id)
        try:
            response = self.get_response(request)
        finally:
            request_id_var.reset(token)
        response["X-Request-ID"] = request_id
        return response


class AccessLogMiddleware:
    """One structured line per request. Never logs bodies (PRD 11: no message content in logs)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started = time.perf_counter()
        response = self.get_response(request)
        duration_ms = round((time.perf_counter() - started) * 1000, 2)

        user = getattr(request, "user", None)
        user_id = str(user.pk) if user is not None and user.is_authenticated else "-"
        user_id_var.set(user_id)

        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": request.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
                "user_id": user_id,
            },
        )
        return response
