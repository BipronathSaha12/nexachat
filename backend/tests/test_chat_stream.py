"""End-to-end behaviour of POST /api/chat/ with the Gemini service stubbed out."""

import json
import uuid

import pytest
from asgiref.sync import async_to_sync

from chat.models import UsageRecord
from chat.services.gemini import StreamChunk
from common.exceptions import GeminiRateLimitError
from conversations.models import Conversation, Message

pytestmark = pytest.mark.django_db(transaction=True)

CHAT_URL = "/api/chat/"


class FakeService:
    """Stands in for GeminiService. Scripted chunks in, optional error out."""

    def __init__(self, chunks=("Hello ", "world"), error=None, usage=(12, 4, 0), title="Generated Title"):
        self.model = "fake-model"
        self.fallback_model = "fake-lite"
        self._chunks, self._error, self._usage, self._title = chunks, error, usage, title

    async def stream(self, contents, system_instruction, *, result=None):
        result.model = self.model
        for text in self._chunks:
            result._parts.append(text)
            yield StreamChunk(text=text)
        if self._error:
            raise self._error
        result.input_tokens, result.output_tokens, result.thinking_tokens = self._usage
        result.finish_reason = "STOP"
        result.stamp_latency()

    async def generate_title(self, user_message):
        return self._title


def install(monkeypatch, service):
    monkeypatch.setattr("chat.views.GeminiService", lambda *a, **k: service)
    return service


def collect(response):
    """Drain the response body. The chat view is async, so its content is an async iterator."""
    content = response.streaming_content
    if hasattr(content, "__aiter__"):
        async def drain():
            return b"".join([chunk async for chunk in content])

        return async_to_sync(drain)()
    return b"".join(content)


def parse_sse(response):
    """Collect the stream into a list of (event, data) pairs."""
    body = collect(response).decode()
    events = []
    for block in body.split("\n\n"):
        if not block.strip() or block.startswith(":"):
            continue
        event, data = None, {}
        for line in block.splitlines():
            if line.startswith("event: "):
                event = line[7:]
            elif line.startswith("data: "):
                data = json.loads(line[6:])
        if event:
            events.append((event, data))
    return events


def post(client, payload):
    return client.post(CHAT_URL, data=json.dumps(payload), content_type="application/json")


# -- auth / validation -------------------------------------------------------

def test_requires_authentication(client):
    response = post(client, {"message": "hi"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_rejects_malformed_json(auth_client):
    response = auth_client.post(CHAT_URL, data="{not json", content_type="application/json")
    assert response.status_code == 400


def test_rejects_empty_message(auth_client, monkeypatch):
    install(monkeypatch, FakeService())
    response = post(auth_client, {"message": "   "})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


def test_rejects_unknown_conversation(auth_client, monkeypatch):
    install(monkeypatch, FakeService())
    response = post(auth_client, {"message": "hi", "conversation_id": str(uuid.uuid4())})
    assert response.status_code == 404


def test_cannot_post_into_another_users_conversation(auth_client, other_user, monkeypatch):
    install(monkeypatch, FakeService())
    theirs = Conversation.objects.create(user=other_user)
    response = post(auth_client, {"message": "hi", "conversation_id": str(theirs.pk)})
    assert response.status_code == 404
    assert not theirs.messages.exists()


# -- happy path --------------------------------------------------------------

def test_stream_emits_meta_deltas_and_done(auth_client, monkeypatch):
    install(monkeypatch, FakeService())
    response = post(auth_client, {"message": "Explain React hooks"})

    assert response.status_code == 200
    assert response["Content-Type"] == "text/event-stream"
    assert response["X-Accel-Buffering"] == "no"

    events = parse_sse(response)
    kinds = [e for e, _ in events]
    assert kinds[0] == "meta"
    assert kinds[-1] == "done"
    assert kinds.count("delta") == 2

    text = "".join(d["text"] for e, d in events if e == "delta")
    assert text == "Hello world"


def test_both_turns_are_persisted(auth_client, monkeypatch):
    install(monkeypatch, FakeService())
    collect(post(auth_client, {"message": "Explain React hooks"}))

    conversation = Conversation.objects.get()
    roles = list(conversation.messages.order_by("created_at").values_list("role", "content"))
    assert roles == [("user", "Explain React hooks"), ("assistant", "Hello world")]


def test_new_conversation_gets_a_generated_title(auth_client, monkeypatch):
    install(monkeypatch, FakeService(title="React Hooks Explained"))
    events = parse_sse(post(auth_client, {"message": "Explain React hooks"}))

    done = dict(events)["done"]
    assert done["title"] == "React Hooks Explained"
    assert Conversation.objects.get().title == "React Hooks Explained"


def test_existing_conversation_keeps_its_title(auth_client, conversation, monkeypatch):
    install(monkeypatch, FakeService(title="Should Not Be Used"))
    collect(post(auth_client, {"message": "another turn", "conversation_id": str(conversation.pk)}))
    conversation.refresh_from_db()
    assert conversation.title == "Existing conversation"


def test_usage_is_recorded(auth_client, monkeypatch):
    install(monkeypatch, FakeService(usage=(120, 45, 7)))
    collect(post(auth_client, {"message": "hi"}))

    record = UsageRecord.objects.get()
    assert record.outcome == UsageRecord.Outcome.SUCCESS
    assert (record.input_tokens, record.output_tokens, record.thinking_tokens) == (120, 45, 7)
    assert record.model == "fake-model"


def test_usage_tokens_land_on_the_assistant_message(auth_client, monkeypatch):
    install(monkeypatch, FakeService(usage=(99, 11, 0)))
    collect(post(auth_client, {"message": "hi"}))

    assistant = Message.objects.get(role=Message.Role.ASSISTANT)
    assert assistant.input_tokens == 99
    assert assistant.output_tokens == 11


def test_history_is_supplied_to_the_model(auth_client, conversation_with_history, monkeypatch):
    captured = {}
    service = FakeService()
    original = service.stream

    async def spy(contents, system_instruction, *, result=None):
        captured["contents"] = contents
        captured["system"] = system_instruction
        async for chunk in original(contents, system_instruction, result=result):
            yield chunk

    service.stream = spy
    install(monkeypatch, service)

    collect(post(auth_client, {"message": "third", "conversation_id": str(conversation_with_history.pk)}))

    texts = [p.text for c in captured["contents"] for p in c.parts]
    assert texts == ["Hello", "Hi there", "third"]
    assert [c.role for c in captured["contents"]] == ["user", "model", "user"]
    assert "helpful" in captured["system"]


# -- failure paths -----------------------------------------------------------

def test_upstream_failure_becomes_a_terminal_error_event(auth_client, monkeypatch):
    install(monkeypatch, FakeService(chunks=(), error=GeminiRateLimitError()))
    response = post(auth_client, {"message": "hi"})

    # The status line is already 200 -- the failure has to arrive in-band.
    assert response.status_code == 200
    events = parse_sse(response)
    assert events[-1][0] == "error"
    assert events[-1][1]["code"] == "upstream_rate_limited"


def test_partial_output_is_kept_when_the_stream_breaks(auth_client, monkeypatch):
    install(monkeypatch, FakeService(chunks=("Half an ",), error=GeminiRateLimitError()))
    parse_sse(post(auth_client, {"message": "hi"}))

    assistant = Message.objects.get(role=Message.Role.ASSISTANT)
    assert assistant.content == "Half an "
    assert assistant.is_error is True
    assert UsageRecord.objects.get().outcome == UsageRecord.Outcome.ERROR


def test_empty_response_is_reported_as_an_error(auth_client, monkeypatch):
    install(monkeypatch, FakeService(chunks=()))
    events = parse_sse(post(auth_client, {"message": "hi"}))
    assert events[-1][0] == "error"
    assert not Message.objects.filter(role=Message.Role.ASSISTANT).exists()


def test_user_message_survives_an_upstream_failure(auth_client, monkeypatch):
    install(monkeypatch, FakeService(chunks=(), error=GeminiRateLimitError()))
    parse_sse(post(auth_client, {"message": "keep me"}))
    assert Message.objects.filter(role=Message.Role.USER, content="keep me").exists()
