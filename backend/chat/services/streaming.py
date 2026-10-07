"""Server-Sent Events framing for the chat stream (PRD 6).

Event contract consumed by the React client:

    event: meta      {"conversation_id", "user_message_id", "message_id", "model"}
    event: delta     {"text": "..."}                      (repeated)
    event: done      {"message_id", "finish_reason", "usage": {...}}
    event: error     {"code", "message", "request_id"}
    : heartbeat                                            (comment, keeps proxies open)

A terminal `done` or `error` is always sent, so the client can always leave the
"streaming" state (PRD 8).
"""

import json

HEARTBEAT = ": heartbeat\n\n"


def sse(event: str, data: dict | None = None) -> str:
    """Encode one SSE frame.

    `json.dumps` guarantees the payload has no bare newlines, which would otherwise
    terminate the frame early and corrupt the stream.
    """
    payload = json.dumps(data or {}, ensure_ascii=False, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


def meta_event(**fields) -> str:
    return sse("meta", fields)


def delta_event(text: str) -> str:
    return sse("delta", {"text": text})


def done_event(**fields) -> str:
    return sse("done", fields)


def error_event(code: str, message: str, request_id: str = "") -> str:
    return sse("error", {"code": code, "message": message, "request_id": request_id})
