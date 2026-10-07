"""Async-safe database helpers for the streaming view.

The chat endpoint runs under ASGI; every ORM call therefore has to cross the
sync boundary explicitly rather than blocking the event loop.
"""

import logging

from asgiref.sync import sync_to_async
from django.db import transaction

from chat.models import UsageRecord
from conversations.models import Conversation, Message

logger = logging.getLogger("chatbot.chat")


@sync_to_async
def get_conversation(user, conversation_id):
    """Scoped to the caller: another user's id is indistinguishable from a missing one."""
    return Conversation.objects.for_user(user).filter(pk=conversation_id).first()


@sync_to_async
def create_conversation(user, *, title="New conversation"):
    return Conversation.objects.create(user=user, title=title)


@sync_to_async
def load_history(conversation, limit):
    """Newest `limit` turns, returned chronologically."""
    qs = (
        conversation.messages.exclude(role=Message.Role.SYSTEM)
        .order_by("-created_at")[:limit]
    )
    return list(reversed(list(qs)))


@sync_to_async
def save_user_message(conversation, content):
    with transaction.atomic():
        message = Message.objects.create(
            conversation=conversation, role=Message.Role.USER, content=content
        )
        conversation.touch()
    return message


@sync_to_async
def save_assistant_message(conversation, *, content, result, is_error=False):
    with transaction.atomic():
        message = Message.objects.create(
            conversation=conversation,
            role=Message.Role.ASSISTANT,
            content=content,
            model=result.model,
            input_tokens=result.input_tokens or None,
            output_tokens=result.output_tokens or None,
            thinking_tokens=result.thinking_tokens or None,
            latency_ms=result.latency_ms or None,
            finish_reason=result.finish_reason,
            is_error=is_error,
        )
        conversation.touch()
    return message


@sync_to_async
def record_usage(*, user, conversation, result, outcome, error_code="", request_id=""):
    try:
        return UsageRecord.objects.create(
            user=user,
            conversation=conversation,
            model=result.model,
            used_fallback=result.used_fallback,
            outcome=outcome,
            error_code=error_code,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            thinking_tokens=result.thinking_tokens,
            latency_ms=result.latency_ms,
            first_token_ms=result.first_token_ms,
            attempts=result.attempts,
            request_id=request_id,
        )
    except Exception:  # noqa: BLE001 -- accounting must never break the response
        logger.exception("usage_record_failed", extra={"request_id": request_id})
        return None


@sync_to_async
def set_title(conversation, title):
    conversation.title = title[:200]
    conversation.save(update_fields=["title", "updated_at"])
