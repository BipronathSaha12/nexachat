"""POST /api/chat/ -- the streaming endpoint (PRD 6, 10).

Runs as a plain async Django view rather than a DRF APIView: DRF's request/response
cycle is synchronous, and holding a worker thread open for the life of a stream does
not scale. Authentication, validation and throttling are applied explicitly here.

Failure policy:
  * Anything that fails BEFORE the first byte returns a normal JSON error response
    with a real status code.
  * Anything that fails AFTER the response has started is delivered as an SSE
    `error` event, because the status line is already on the wire.
Either way the client always receives a terminal event.
"""

import asyncio
import json
import logging

from asgiref.sync import sync_to_async
from django.conf import settings
from django.http import JsonResponse, StreamingHttpResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken, TokenError

from chat.models import UsageRecord
from chat.serializers import ChatRequestSerializer
from chat.services import persistence as db
from chat.services.context import build_contents
from chat.services.gemini import GeminiService, StreamResult
from chat.services.prompts import resolve_system_instruction
from chat.services.streaming import HEARTBEAT, delta_event, done_event, error_event, meta_event
from common.exceptions import ContextTooLargeError, ErrorCode, ServiceError
from common.throttling import ChatBurstThrottle, ChatDailyThrottle

logger = logging.getLogger("chatbot.chat")

MAX_BODY_BYTES = 256 * 1024


def _json_error(code: str, message: str, status: int, request_id: str = "", **extra):
    body = {"error": {"code": code, "message": message, "request_id": request_id, **extra}}
    return JsonResponse(body, status=status)


@sync_to_async
def _authenticate(request):
    """Resolve the bearer token to a user, or None."""
    try:
        auth = JWTAuthentication().authenticate(request)
    except (InvalidToken, TokenError, AuthenticationFailed):
        return None
    return auth[0] if auth else None


class _ThrottleView:
    """Minimal stand-in so DRF throttle classes can be reused outside a DRF view."""

    throttle_scope = "chat_minute"


@sync_to_async
def _check_throttles(request):
    """Returns seconds to wait if limited, else None (PRD 12)."""
    for throttle in (ChatBurstThrottle(), ChatDailyThrottle()):
        if not throttle.allow_request(request, _ThrottleView()):
            return int(throttle.wait() or 1)
    return None


async def _iter_with_heartbeat(agen, interval: float):
    """Yield ('item'|'error'|'heartbeat', value), emitting a heartbeat during idle gaps.

    Proxies and load balancers close connections that look idle; a thinking model can
    easily exceed that window before its first token.
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=64)

    async def produce():
        try:
            async for item in agen:
                await queue.put(("item", item))
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 -- forwarded to the consumer
            await queue.put(("error", exc))
        finally:
            await queue.put(("eof", None))

    task = asyncio.create_task(produce())
    try:
        while True:
            try:
                kind, value = await asyncio.wait_for(queue.get(), timeout=interval)
            except TimeoutError:
                yield "heartbeat", None
                continue
            if kind == "eof":
                return
            yield kind, value
    finally:
        task.cancel()
        # Let the producer unwind so the SDK connection is closed, not leaked.
        await asyncio.gather(task, return_exceptions=True)


@method_decorator(csrf_exempt, name="dispatch")
class ChatStreamView(View):
    """Streams a Gemini reply and persists both turns."""

    http_method_names = ["post"]

    async def post(self, request):  # noqa: PLR0911 -- one early return per distinct failure mode
        request_id = getattr(request, "request_id", "")

        # -- authentication -------------------------------------------------
        user = await _authenticate(request)
        if user is None:
            return _json_error(
                ErrorCode.AUTHENTICATION, "Authentication credentials were not provided or are invalid.",
                401, request_id,
            )
        request.user = user

        # -- body -----------------------------------------------------------
        if len(request.body) > MAX_BODY_BYTES:
            return _json_error(ErrorCode.VALIDATION, "Request body is too large.", 413, request_id)
        try:
            payload = json.loads(request.body or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            return _json_error(ErrorCode.VALIDATION, "Request body must be valid JSON.", 400, request_id)

        serializer = ChatRequestSerializer(data=payload)
        try:
            await sync_to_async(serializer.is_valid)(raise_exception=True)
        except ValidationError as exc:
            return _json_error(
                ErrorCode.VALIDATION, "The request was invalid.", 400, request_id, details=exc.detail
            )
        data = serializer.validated_data

        # -- rate limiting ---------------------------------------------------
        wait = await _check_throttles(request)
        if wait is not None:
            response = _json_error(
                ErrorCode.THROTTLED,
                f"Rate limit exceeded. Try again in {wait} seconds.",
                429, request_id,
            )
            response["Retry-After"] = str(wait)
            return response

        # -- conversation ----------------------------------------------------
        conversation_id = data.get("conversation_id")
        is_new = False
        if conversation_id:
            conversation = await db.get_conversation(user, conversation_id)
            if conversation is None:
                return _json_error(ErrorCode.NOT_FOUND, "Conversation not found.", 404, request_id)
        else:
            conversation = await db.create_conversation(user)
            is_new = True

        user_message = data["message"]

        # -- context ---------------------------------------------------------
        history = await db.load_history(conversation, settings.CONTEXT["MAX_MESSAGES"] * 2)
        context = build_contents(
            history,
            user_message,
            resolve_system_instruction(conversation.system_instruction),
        )
        if not context.contents:
            exc = ContextTooLargeError()
            return _json_error(exc.default_code, str(exc.detail), exc.status_code, request_id)

        # -- service ----------------------------------------------------------
        try:
            service = await sync_to_async(GeminiService)()
        except ServiceError as exc:
            logger.exception("gemini_init_failed", extra={"request_id": request_id})
            return _json_error(exc.default_code, str(exc.detail), exc.status_code, request_id)

        stored_user_message = await db.save_user_message(conversation, user_message)

        response = StreamingHttpResponse(
            self._event_stream(
                service=service,
                context=context,
                user=user,
                conversation=conversation,
                stored_user_message=stored_user_message,
                user_message=user_message,
                is_new=is_new,
                request_id=request_id,
            ),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache, no-transform"
        response["X-Accel-Buffering"] = "no"  # nginx: do not buffer the stream
        response["Connection"] = "keep-alive"
        return response

    async def _event_stream(
        self, *, service, context, user, conversation, stored_user_message,
        user_message, is_new, request_id,
    ):
        result = StreamResult(model=service.model)
        outcome = UsageRecord.Outcome.SUCCESS
        error_code = ""
        emitted_text = False

        yield meta_event(
            conversation_id=str(conversation.pk),
            user_message_id=str(stored_user_message.pk),
            model=service.model,
            request_id=request_id,
            context_messages=context.included_messages,
            dropped_messages=context.dropped_messages,
        )

        stream = service.stream(context.contents, context.system_instruction, result=result)

        try:
            async for kind, value in _iter_with_heartbeat(
                stream, settings.STREAM["HEARTBEAT_SECONDS"]
            ):
                if kind == "heartbeat":
                    yield HEARTBEAT
                elif kind == "error":
                    raise value
                elif value.text:
                    emitted_text = True
                    yield delta_event(value.text)

        except asyncio.CancelledError:
            # Client navigated away or aborted. Persist what we produced, then re-raise.
            outcome = UsageRecord.Outcome.CANCELLED
            await self._finalize(
                user=user, conversation=conversation, result=result,
                outcome=outcome, error_code="client_disconnected",
                request_id=request_id, save_message=emitted_text,
            )
            logger.info("chat_stream_cancelled", extra={"request_id": request_id})
            raise

        except ServiceError as exc:
            outcome = UsageRecord.Outcome.ERROR
            error_code = exc.default_code
            logger.warning(
                "chat_stream_failed",
                extra={"request_id": request_id, "code": error_code, "partial": emitted_text},
            )
            await self._finalize(
                user=user, conversation=conversation, result=result, outcome=outcome,
                error_code=error_code, request_id=request_id, save_message=emitted_text,
                is_error=True,
            )
            yield error_event(exc.default_code, str(exc.detail), request_id)
            return

        except Exception:  # noqa: BLE001 -- last line of defence; the stream must terminate
            logger.exception("chat_stream_unhandled", extra={"request_id": request_id})
            await self._finalize(
                user=user, conversation=conversation, result=result,
                outcome=UsageRecord.Outcome.ERROR, error_code=ErrorCode.INTERNAL,
                request_id=request_id, save_message=emitted_text, is_error=True,
            )
            yield error_event(ErrorCode.INTERNAL, "Something went wrong. Please try again.", request_id)
            return

        # -- safety block: a completed stream that produced nothing -------------
        if result.blocked or not result.text.strip():
            outcome = (
                UsageRecord.Outcome.BLOCKED if result.blocked else UsageRecord.Outcome.ERROR
            )
            code = "content_blocked" if result.blocked else ErrorCode.UPSTREAM
            message = (
                "The response was blocked by a safety filter. Try rephrasing your message."
                if result.blocked
                else "The AI service returned an empty response. Please try again."
            )
            await db.record_usage(
                user=user, conversation=conversation, result=result,
                outcome=outcome, error_code=code, request_id=request_id,
            )
            yield error_event(code, message, request_id)
            return

        # -- success -----------------------------------------------------------
        assistant_message = await db.save_assistant_message(
            conversation, content=result.text, result=result
        )
        await db.record_usage(
            user=user, conversation=conversation, result=result,
            outcome=outcome, error_code=error_code, request_id=request_id,
        )

        title = None
        if is_new:
            title = await service.generate_title(user_message)
            if title:
                await db.set_title(conversation, title)

        yield done_event(
            message_id=str(assistant_message.pk),
            conversation_id=str(conversation.pk),
            finish_reason=result.finish_reason,
            title=title or conversation.title,
            usage={
                "model": result.model,
                "input_tokens": result.input_tokens,
                "output_tokens": result.output_tokens,
                "thinking_tokens": result.thinking_tokens,
                "latency_ms": result.latency_ms,
                "first_token_ms": result.first_token_ms,
                "used_fallback": result.used_fallback,
            },
        )

    async def _finalize(
        self, *, user, conversation, result, outcome, error_code,
        request_id, save_message, is_error=False,
    ):
        """Persist a partial answer plus the usage row for a stream that did not complete."""
        result.stamp_latency()
        if save_message and result.text.strip():
            await db.save_assistant_message(
                conversation, content=result.text, result=result, is_error=is_error
            )
        await db.record_usage(
            user=user, conversation=conversation, result=result,
            outcome=outcome, error_code=error_code, request_id=request_id,
        )
