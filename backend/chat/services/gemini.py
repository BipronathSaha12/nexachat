"""Gemini service layer (PRD 5.3).

Everything that knows about Gemini lives here. Views never import `google.genai`,
never see the API key, and never handle a provider-specific error shape.
"""

import asyncio
import logging
import random
import time
from dataclasses import dataclass, field

from django.conf import settings
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from common.exceptions import GeminiError, GeminiRateLimitError, GeminiTimeoutError

logger = logging.getLogger("chatbot.gemini")

# Transient upstream conditions worth another attempt.
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_BASE_BACKOFF_SECONDS = 0.5
_MAX_BACKOFF_SECONDS = 8.0


@dataclass
class StreamChunk:
    """One incremental piece of a response."""

    text: str = ""
    finish_reason: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    thinking_tokens: int = 0


@dataclass
class StreamResult:
    """Running accounting for a stream -- feeds Message + UsageRecord.

    `text` is derived from the parts collected so far, so a stream that is cancelled
    or fails midway still exposes everything the model produced before it stopped.
    """

    model: str = ""
    finish_reason: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    thinking_tokens: int = 0
    latency_ms: int = 0
    first_token_ms: int = 0
    attempts: int = 1
    used_fallback: bool = False
    blocked: bool = False
    block_reason: str = ""
    chunks: int = 0
    started_at: float = 0.0
    _parts: list[str] = field(default_factory=list, repr=False)

    @property
    def text(self) -> str:
        return "".join(self._parts)

    def stamp_latency(self) -> None:
        """Record elapsed time; safe to call on the success, error and cancel paths."""
        if self.started_at:
            self.latency_ms = int((time.perf_counter() - self.started_at) * 1000)


class GeminiService:
    """Thin, testable wrapper around the Google GenAI client."""

    def __init__(self, *, api_key: str | None = None, config: dict | None = None):
        cfg = {**settings.GEMINI, **(config or {})}
        self._api_key = api_key or cfg["API_KEY"]
        if not self._api_key:
            raise GeminiError("GEMINI_API_KEY is not configured.")
        self.model = cfg["MODEL"]
        self.fallback_model = cfg["FALLBACK_MODEL"]
        self.timeout_seconds = cfg["TIMEOUT_SECONDS"]
        self.max_retries = cfg["MAX_RETRIES"]
        self.max_output_tokens = cfg["MAX_OUTPUT_TOKENS"]
        self.temperature = cfg["TEMPERATURE"]
        self.thinking_level = cfg["THINKING_LEVEL"]
        self._client = genai.Client(
            api_key=self._api_key,
            # SDK timeout is milliseconds.
            http_options=types.HttpOptions(timeout=self.timeout_seconds * 1000),
        )

    # -- configuration ----------------------------------------------------
    def _generation_config(self, system_instruction: str) -> types.GenerateContentConfig:
        # Gemini 3.x takes `thinking_level`; the older `thinking_budget` is rejected
        # with a 400 by these models. An empty setting leaves the model default alone.
        thinking = (
            types.ThinkingConfig(thinking_level=self.thinking_level)
            if self.thinking_level
            else None
        )

        return types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=self.temperature,
            max_output_tokens=self.max_output_tokens,
            thinking_config=thinking,
            safety_settings=[
                types.SafetySetting(category=c, threshold="BLOCK_ONLY_HIGH")
                for c in (
                    "HARM_CATEGORY_HATE_SPEECH",
                    "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "HARM_CATEGORY_HARASSMENT",
                )
            ],
        )

    # -- error translation ------------------------------------------------
    @staticmethod
    def _status_of(exc: Exception) -> int | None:
        code = getattr(exc, "code", None)
        if isinstance(code, int):
            return code
        return getattr(getattr(exc, "response", None), "status_code", None)

    @staticmethod
    def _upstream_detail(exc: Exception) -> str:
        """Provider-supplied reason. Logged server side only -- never returned to the client."""
        return str(getattr(exc, "message", None) or exc)[:300]

    @classmethod
    def _translate(cls, exc: Exception) -> Exception:
        """Provider exception -> our stable API exception. Never leaks the raw message."""
        if isinstance(exc, TimeoutError | asyncio.TimeoutError):
            return GeminiTimeoutError()
        status = cls._status_of(exc)
        if status == 429:
            return GeminiRateLimitError()
        if status in (504, 408):
            return GeminiTimeoutError()
        return GeminiError()

    @classmethod
    def _is_retryable(cls, exc: Exception) -> bool:
        if isinstance(exc, TimeoutError | asyncio.TimeoutError | genai_errors.ServerError):
            return True
        return cls._status_of(exc) in _RETRYABLE_STATUS

    @staticmethod
    def _backoff(attempt: int) -> float:
        """Exponential backoff with full jitter -- avoids a retry stampede across workers."""
        ceiling = min(_MAX_BACKOFF_SECONDS, _BASE_BACKOFF_SECONDS * (2**attempt))
        return random.uniform(0, ceiling)  # noqa: S311 -- scheduling jitter, not a secret

    # -- streaming --------------------------------------------------------
    async def stream(
        self,
        contents: list[types.Content],
        system_instruction: str,
        *,
        result: StreamResult | None = None,
    ):
        """Yield StreamChunk objects as Gemini produces them (PRD 6).

        Retries only before the first token is emitted. Once bytes are on the wire we
        cannot silently restart -- the client has already rendered partial text.
        """
        result = result if result is not None else StreamResult()
        config = self._generation_config(system_instruction)
        started = time.perf_counter()
        result.started_at = started
        models_to_try = [self.model]
        if self.fallback_model and self.fallback_model != self.model:
            models_to_try.append(self.fallback_model)

        last_exc: Exception | None = None

        for model_index, model in enumerate(models_to_try):
            for attempt in range(self.max_retries):
                result.attempts = attempt + 1
                result.model = model
                result.used_fallback = model_index > 0
                emitted = False
                try:
                    stream = await self._client.aio.models.generate_content_stream(
                        model=model, contents=contents, config=config
                    )
                    async for raw in stream:
                        chunk = self._parse(raw, result)
                        if chunk is None:
                            continue
                        if chunk.text and not emitted:
                            emitted = True
                            result.first_token_ms = int((time.perf_counter() - started) * 1000)
                        yield chunk
                    result.stamp_latency()
                    return

                except Exception as exc:  # noqa: BLE001 -- translated below
                    last_exc = exc
                    result.stamp_latency()
                    if emitted:
                        # Mid-stream failure: surface it, never silently retry.
                        logger.warning(
                            "gemini_stream_broken_midstream",
                            extra={
                                "model": model,
                                "attempt": attempt + 1,
                                "error": type(exc).__name__,
                                "upstream_detail": self._upstream_detail(exc),
                            },
                        )
                        raise self._translate(exc) from exc
                    if not self._is_retryable(exc):
                        logger.error(
                            "gemini_request_rejected",
                            extra={
                                "model": model,
                                "status": self._status_of(exc),
                                "error": type(exc).__name__,
                                "upstream_detail": self._upstream_detail(exc),
                            },
                        )
                        raise self._translate(exc) from exc

                    logger.warning(
                        "gemini_retry",
                        extra={
                            "model": model,
                            "attempt": attempt + 1,
                            "status": self._status_of(exc),
                            "error": type(exc).__name__,
                            "upstream_detail": self._upstream_detail(exc),
                        },
                    )
                    if attempt < self.max_retries - 1:
                        await asyncio.sleep(self._backoff(attempt))

            logger.warning("gemini_model_exhausted", extra={"model": model})

        raise self._translate(last_exc or GeminiError())

    def _parse(self, raw, result: StreamResult) -> StreamChunk | None:
        """Normalise one SDK chunk, accumulating usage onto `result`."""
        chunk = StreamChunk()

        usage = getattr(raw, "usage_metadata", None)
        if usage:
            # Gemini reports cumulative totals per chunk; last value wins.
            result.input_tokens = usage.prompt_token_count or result.input_tokens
            result.output_tokens = usage.candidates_token_count or result.output_tokens
            result.thinking_tokens = getattr(usage, "thoughts_token_count", None) or result.thinking_tokens

        feedback = getattr(raw, "prompt_feedback", None)
        if feedback is not None and getattr(feedback, "block_reason", None):
            result.blocked = True
            result.block_reason = str(feedback.block_reason)
            return None

        for candidate in getattr(raw, "candidates", None) or []:
            finish = getattr(candidate, "finish_reason", None)
            if finish:
                # The SDK hands back an enum; str() would emit "FinishReason.STOP".
                chunk.finish_reason = getattr(finish, "name", None) or str(finish)
                result.finish_reason = chunk.finish_reason
            content = getattr(candidate, "content", None)
            for part in getattr(content, "parts", None) or []:
                # Skip reasoning traces: they are not part of the user-visible answer.
                if getattr(part, "thought", False):
                    continue
                text = getattr(part, "text", None)
                if text:
                    chunk.text += text

        if chunk.text:
            result._parts.append(chunk.text)
            result.chunks += 1
        elif not chunk.finish_reason:
            return None

        return chunk

    # -- non-streaming helper ---------------------------------------------
    async def generate_title(self, user_message: str) -> str:
        """Short conversation title (PRD 5.6). Best effort: failure must not break chat."""
        from chat.services.prompts import TITLE_INSTRUCTION  # noqa: PLC0415 -- avoids an import cycle

        try:
            response = await self._client.aio.models.generate_content(
                model=self.fallback_model or self.model,
                contents=[types.Content(role="user", parts=[types.Part(text=user_message[:2000])])],
                config=types.GenerateContentConfig(
                    system_instruction=TITLE_INSTRUCTION,
                    temperature=0.3,
                    max_output_tokens=512,
                    thinking_config=(
                        types.ThinkingConfig(thinking_level="low") if self.thinking_level else None
                    ),
                ),
            )
            title = (response.text or "").strip().strip('"').replace("\n", " ")
            return title[:200] or ""
        except Exception as exc:  # noqa: BLE001 -- titles are cosmetic
            logger.info("title_generation_failed", extra={"error": type(exc).__name__})
            return ""
