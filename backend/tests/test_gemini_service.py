"""GeminiService behaviour with a stubbed SDK -- no network in the default run."""

from types import SimpleNamespace

import pytest
from google.genai import errors as genai_errors

from chat.services.gemini import GeminiService, StreamResult
from common.exceptions import GeminiError, GeminiRateLimitError, GeminiTimeoutError


def _chunk(text="", finish=None, usage=None, thought=False):
    part = SimpleNamespace(text=text, thought=thought)
    candidate = SimpleNamespace(content=SimpleNamespace(parts=[part]), finish_reason=finish)
    return SimpleNamespace(candidates=[candidate], usage_metadata=usage, prompt_feedback=None)


def _usage(prompt=10, out=5, thoughts=0):
    return SimpleNamespace(
        prompt_token_count=prompt, candidates_token_count=out, thoughts_token_count=thoughts
    )


class _FakeStream:
    def __init__(self, chunks, raise_after=None, exc=None):
        self._chunks, self._raise_after, self._exc = chunks, raise_after, exc

    def __aiter__(self):
        async def gen():
            for i, chunk in enumerate(self._chunks):
                if self._raise_after is not None and i == self._raise_after:
                    raise self._exc
                yield chunk
            if self._raise_after == len(self._chunks):
                raise self._exc

        return gen()


@pytest.fixture
def service(settings):
    settings.GEMINI = {**settings.GEMINI, "API_KEY": "test-key", "MAX_RETRIES": 3}
    return GeminiService()


def _install(service, behaviours):
    """Replace the SDK call with a scripted sequence of outcomes."""
    calls = []

    async def fake(*, model, contents, config):
        calls.append(model)
        behaviour = behaviours[min(len(calls) - 1, len(behaviours) - 1)]
        if isinstance(behaviour, Exception):
            raise behaviour
        return behaviour

    service._client = SimpleNamespace(
        aio=SimpleNamespace(models=SimpleNamespace(generate_content_stream=fake))
    )
    return calls


async def _drain(service, result=None):
    result = result or StreamResult()
    texts = [c.text async for c in service.stream([], "sys", result=result) if c.text]
    return texts, result


async def test_stream_yields_text_and_accumulates_usage(service):
    _install(
        service,
        [_FakeStream([_chunk("Hello "), _chunk("world", finish="STOP", usage=_usage(10, 2, 7))])],
    )
    texts, result = await _drain(service)
    assert texts == ["Hello ", "world"]
    assert result.text == "Hello world"
    assert (result.input_tokens, result.output_tokens, result.thinking_tokens) == (10, 2, 7)
    assert result.finish_reason == "STOP"
    assert result.latency_ms >= 0


async def test_thought_parts_are_not_shown_to_the_user(service):
    _install(service, [_FakeStream([_chunk("secret reasoning", thought=True), _chunk("answer")])])
    texts, result = await _drain(service)
    assert result.text == "answer"
    assert "secret" not in "".join(texts)


async def test_retries_a_retryable_error_before_the_first_token(service):
    boom = genai_errors.ServerError(503, {"error": {"code": 503, "message": "boom"}})
    calls = _install(service, [boom, _FakeStream([_chunk("recovered")])])
    _, result = await _drain(service)
    assert result.text == "recovered"
    assert len(calls) == 2
    assert result.attempts == 2


async def test_does_not_retry_after_bytes_are_emitted(service):
    """Retrying mid-stream would duplicate text the client already rendered."""
    boom = genai_errors.ServerError(503, {"error": {"code": 503, "message": "boom"}})
    stream = _FakeStream([_chunk("partial")], raise_after=1, exc=boom)
    calls = _install(service, [stream])
    result = StreamResult()

    with pytest.raises(GeminiError):
        async for _ in service.stream([], "sys", result=result):
            pass

    assert len(calls) == 1
    assert result.text == "partial"  # partial output is preserved for persistence


async def test_falls_back_to_the_secondary_model_when_the_primary_is_exhausted(service):
    boom = genai_errors.ServerError(503, {"error": {"code": 503, "message": "down"}})
    calls = _install(service, [boom, boom, boom, _FakeStream([_chunk("from fallback")])])
    _, result = await _drain(service)
    assert result.text == "from fallback"
    assert result.used_fallback is True
    assert calls[-1] == service.fallback_model


async def test_rate_limit_is_translated_to_429(service):
    err = genai_errors.ClientError(429, {"error": {"code": 429, "message": "quota"}})
    _install(service, [err])
    with pytest.raises(GeminiRateLimitError):
        await _drain(service)


async def test_timeout_is_translated_to_504(service):
    _install(service, [TimeoutError()])
    with pytest.raises(GeminiTimeoutError):
        await _drain(service)


async def test_non_retryable_client_error_fails_immediately(service):
    err = genai_errors.ClientError(400, {"error": {"code": 400, "message": "bad request"}})
    calls = _install(service, [err])
    with pytest.raises(GeminiError):
        await _drain(service)
    assert len(calls) == 1  # no wasted retries on a request that can never succeed


async def test_safety_block_is_surfaced_on_the_result(service):
    blocked = SimpleNamespace(
        candidates=[], usage_metadata=None,
        prompt_feedback=SimpleNamespace(block_reason="SAFETY"),
    )
    _install(service, [_FakeStream([blocked])])
    _, result = await _drain(service)
    assert result.blocked is True
    assert result.text == ""


def test_missing_api_key_fails_fast(settings):
    settings.GEMINI = {**settings.GEMINI, "API_KEY": ""}
    with pytest.raises(GeminiError):
        GeminiService()


def test_backoff_is_bounded_and_jittered(service):
    values = [service._backoff(attempt) for attempt in range(6) for _ in range(20)]
    assert all(0 <= v <= 8.0 for v in values)
    assert len(set(values)) > 1  # jitter, not a fixed schedule
