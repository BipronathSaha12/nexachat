"""Context assembly and trimming (PRD 5.5)."""

import pytest

from chat.services.context import build_contents, estimate_tokens
from chat.services.prompts import DEFAULT_SYSTEM_INSTRUCTION, resolve_system_instruction
from conversations.models import Message

pytestmark = pytest.mark.django_db


def _msg(role, content):
    return Message(role=role, content=content)


def test_current_message_is_always_last():
    built = build_contents([], "hello", "sys")
    assert len(built.contents) == 1
    assert built.contents[-1].role == "user"
    assert built.contents[-1].parts[0].text == "hello"


def test_history_is_mapped_to_gemini_roles():
    history = [
        _msg(Message.Role.USER, "q1"),
        _msg(Message.Role.ASSISTANT, "a1"),
    ]
    built = build_contents(history, "q2", "sys")
    assert [c.role for c in built.contents] == ["user", "model", "user"]


def test_system_turns_are_excluded_from_contents():
    history = [_msg(Message.Role.SYSTEM, "internal"), _msg(Message.Role.USER, "q1")]
    built = build_contents(history, "q2", "sys")
    assert built.included_messages == 1


def test_blank_history_entries_are_skipped():
    history = [_msg(Message.Role.ASSISTANT, "   "), _msg(Message.Role.USER, "real")]
    built = build_contents(history, "q", "sys")
    assert built.included_messages == 1


def test_message_count_cap_is_enforced():
    history = [_msg(Message.Role.USER, f"m{i}") for i in range(50)]
    built = build_contents(history, "now", "sys", max_messages=5)
    assert built.included_messages == 5
    assert built.dropped_messages == 45


def test_token_budget_drops_oldest_first():
    history = [
        _msg(Message.Role.USER, "OLDEST" * 100),
        _msg(Message.Role.ASSISTANT, "MIDDLE" * 100),
        _msg(Message.Role.USER, "NEWEST" * 10),
    ]
    built = build_contents(history, "now", "sys", max_tokens=300)
    kept = " ".join(p.text for c in built.contents for p in c.parts)
    assert "NEWEST" in kept
    assert "OLDEST" not in kept


def test_oversized_current_message_yields_no_contents():
    """Signals the caller to return 413 rather than sending a doomed request."""
    built = build_contents([], "x" * 100_000, "sys", max_tokens=100)
    assert built.contents == []


def test_estimate_tokens_is_never_zero():
    assert estimate_tokens("") >= 1
    assert estimate_tokens("a" * 400) > 50


def test_conversation_override_beats_the_default_prompt():
    assert resolve_system_instruction("  Be terse.  ") == "Be terse."
    assert resolve_system_instruction("   ") == DEFAULT_SYSTEM_INSTRUCTION
    assert resolve_system_instruction("") == DEFAULT_SYSTEM_INSTRUCTION
