"""Build the model context from system instruction + history + current message (PRD 5.4, 5.5).

Token budgeting matters: an unbounded history eventually exceeds the context window and
every request gets more expensive. We trim oldest-first and always keep the newest turn.
"""

import logging
from dataclasses import dataclass

from django.conf import settings
from google.genai import types

from conversations.models import Message

logger = logging.getLogger("chatbot.context")

# Cheap local estimate. Roughly 4 characters per token for English + code.
# Used only for trimming decisions; authoritative counts come back in usage metadata.
_CHARS_PER_TOKEN = 4
_ROLE_MAP = {Message.Role.USER: "user", Message.Role.ASSISTANT: "model"}


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // _CHARS_PER_TOKEN)


@dataclass(frozen=True)
class BuiltContext:
    contents: list[types.Content]
    system_instruction: str
    estimated_input_tokens: int
    included_messages: int
    dropped_messages: int


def build_contents(
    history: list[Message],
    user_message: str,
    system_instruction: str,
    *,
    max_tokens: int | None = None,
    max_messages: int | None = None,
) -> BuiltContext:
    """Assemble Gemini `contents`, newest-first within budget, then restored to chronological order.

    `history` must be chronological and must NOT contain the current user message.
    """
    max_tokens = max_tokens or settings.CONTEXT["MAX_TOKENS"]
    max_messages = max_messages or settings.CONTEXT["MAX_MESSAGES"]

    system_cost = estimate_tokens(system_instruction)
    current_cost = estimate_tokens(user_message)
    budget = max_tokens - system_cost - current_cost

    if budget < 0:
        # Even the bare message does not fit; the caller turns this into a 413.
        return BuiltContext([], system_instruction, system_cost + current_cost, 0, len(history))

    kept: list[Message] = []
    used = 0
    # Walk backwards so the most recent, most relevant turns survive trimming.
    for message in reversed(history):
        if message.role == Message.Role.SYSTEM or not message.content.strip():
            continue
        if len(kept) >= max_messages:
            break
        cost = estimate_tokens(message.content)
        if used + cost > budget:
            break
        kept.append(message)
        used += cost

    kept.reverse()
    dropped = len([m for m in history if m.role != Message.Role.SYSTEM]) - len(kept)

    contents = [
        types.Content(role=_ROLE_MAP[m.role], parts=[types.Part(text=m.content)])
        for m in kept
    ]
    contents.append(types.Content(role="user", parts=[types.Part(text=user_message)]))

    if dropped:
        logger.info("context_trimmed", extra={"dropped": dropped, "kept": len(kept)})

    return BuiltContext(
        contents=contents,
        system_instruction=system_instruction,
        estimated_input_tokens=system_cost + current_cost + used,
        included_messages=len(kept),
        dropped_messages=dropped,
    )
