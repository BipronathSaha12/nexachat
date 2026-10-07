"""Contract tests against the real Gemini API.

Excluded from the default run: `pytest -m integration` opts in. These exist because
the SDK's accepted parameters change between model generations -- `thinking_budget`
is rejected with a 400 by Gemini 3.x, and only a live call catches that.
"""

import os

import pytest
from google.genai import types

from chat.services.gemini import GeminiService, StreamResult
from chat.services.prompts import DEFAULT_SYSTEM_INSTRUCTION

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not os.environ.get("GEMINI_API_KEY"),
        reason="GEMINI_API_KEY is not set in the environment",
    ),
]


@pytest.fixture
def live_service(settings):
    settings.GEMINI = {**settings.GEMINI, "API_KEY": os.environ["GEMINI_API_KEY"]}
    return GeminiService()


def _user(text):
    return [types.Content(role="user", parts=[types.Part(text=text)])]


async def test_configured_model_accepts_our_generation_config(live_service):
    """Catches a config parameter the configured model rejects."""
    result = StreamResult()
    chunks = [
        c.text
        async for c in live_service.stream(
            _user("Reply with exactly: ok"), DEFAULT_SYSTEM_INSTRUCTION, result=result
        )
        if c.text
    ]
    assert chunks, "the model produced no text"
    assert result.text.strip()
    assert result.input_tokens > 0
    assert result.finish_reason == "STOP"


async def test_fallback_model_also_accepts_our_generation_config(live_service):
    live_service.model = live_service.fallback_model
    result = StreamResult()
    async for _ in live_service.stream(_user("Reply with exactly: ok"), "Be terse.", result=result):
        pass
    assert result.text.strip()


async def test_streaming_arrives_in_more_than_one_chunk(live_service):
    """If this collapses to a single chunk the UI has no progressive rendering."""
    result = StreamResult()
    async for _ in live_service.stream(
        _user("Count from 1 to 40, one number per line."), DEFAULT_SYSTEM_INSTRUCTION, result=result
    ):
        pass
    assert result.chunks > 1


async def test_title_generation_returns_a_short_plain_string(live_service):
    title = await live_service.generate_title("Explain React hooks with a useState example")
    assert title
    assert len(title) <= 200
    assert "\n" not in title
