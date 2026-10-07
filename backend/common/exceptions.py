"""Uniform error envelope. Technical detail is logged; users get a stable code + safe message.

PRD 8: "Technical details should be logged server side while users receive clear messages."
"""

import logging
import uuid

from django.db import DatabaseError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger("chatbot.errors")


class ErrorCode:
    VALIDATION = "validation_error"
    AUTHENTICATION = "authentication_error"
    PERMISSION = "permission_denied"
    NOT_FOUND = "not_found"
    THROTTLED = "rate_limited"
    UPSTREAM = "upstream_error"
    UPSTREAM_TIMEOUT = "upstream_timeout"
    UPSTREAM_RATE_LIMIT = "upstream_rate_limited"
    CONTEXT_TOO_LARGE = "context_too_large"
    DATABASE = "database_error"
    INTERNAL = "internal_error"


class ServiceError(APIException):
    """Base for errors raised by the service layer."""

    status_code = status.HTTP_502_BAD_GATEWAY
    default_code = ErrorCode.UPSTREAM
    default_detail = "The upstream service failed. Please try again."


class GeminiError(ServiceError):
    default_detail = "The AI service is temporarily unavailable. Please try again."


class GeminiTimeoutError(ServiceError):
    status_code = status.HTTP_504_GATEWAY_TIMEOUT
    default_code = ErrorCode.UPSTREAM_TIMEOUT
    default_detail = "The AI service took too long to respond. Please try again."


class GeminiRateLimitError(ServiceError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_code = ErrorCode.UPSTREAM_RATE_LIMIT
    default_detail = "The AI service is rate limited right now. Please retry shortly."


class ContextTooLargeError(APIException):
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    default_code = ErrorCode.CONTEXT_TOO_LARGE
    default_detail = "This conversation is too long to continue. Start a new conversation."


def _envelope(code: str, message: str, *, request_id: str, details=None) -> dict:
    body = {"error": {"code": code, "message": message, "request_id": request_id}}
    if details:
        body["error"]["details"] = details
    return body


_STATUS_TO_CODE = {
    400: ErrorCode.VALIDATION,
    401: ErrorCode.AUTHENTICATION,
    403: ErrorCode.PERMISSION,
    404: ErrorCode.NOT_FOUND,
    429: ErrorCode.THROTTLED,
}


def api_exception_handler(exc, context):
    """DRF exception handler producing one predictable shape for every failure."""
    request = context.get("request")
    request_id = getattr(request, "request_id", None) or uuid.uuid4().hex

    # Do not leak "this conversation exists but is not yours".
    if isinstance(exc, PermissionDenied):
        exc = Http404()

    if isinstance(exc, DatabaseError):
        logger.exception("database_error", extra={"request_id": request_id})
        return Response(
            _envelope(
                ErrorCode.DATABASE,
                "A storage error occurred. Please try again.",
                request_id=request_id,
            ),
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    response = drf_exception_handler(exc, context)

    if response is None:
        logger.exception("unhandled_exception", extra={"request_id": request_id})
        return Response(
            _envelope(ErrorCode.INTERNAL, "Something went wrong. Please try again.", request_id=request_id),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Only our own exceptions may name their code; DRF's defaults (e.g.
    # "authentication_failed") would otherwise make the published contract unstable.
    if isinstance(exc, ServiceError | ContextTooLargeError):
        code = exc.default_code
    else:
        code = _STATUS_TO_CODE.get(response.status_code, ErrorCode.INTERNAL)
    detail = response.data

    if isinstance(detail, dict) and "detail" not in detail:
        # Field-level validation errors: keep them, they are user actionable.
        message = "The request was invalid."
        details = detail
    else:
        message = str(detail.get("detail")) if isinstance(detail, dict) else str(detail)
        details = None

    if response.status_code >= 500:
        logger.exception("server_error", extra={"request_id": request_id, "code": code})
    else:
        logger.warning(
            "client_error",
            extra={"request_id": request_id, "code": code, "status": response.status_code},
        )

    response.data = _envelope(code, message, request_id=request_id, details=details)
    return response
