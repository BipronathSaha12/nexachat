"""OpenAPI post-processing.

The chat endpoint is a plain async Django view, so drf-spectacular cannot introspect
it. Left alone, the published contract would silently omit the product's main
endpoint, so it is described here instead.
"""

CHAT_PATH = "/api/chat/"

_SSE_DESCRIPTION = """\
Streams the assistant reply as Server-Sent Events.

Frames:

* `event: meta` — `{conversation_id, user_message_id, model, request_id, context_messages, dropped_messages}`
* `event: delta` — `{text}`, repeated as the model produces output
* `event: done` — `{message_id, conversation_id, finish_reason, title, usage}`
* `event: error` — `{code, message, request_id}`
* `: heartbeat` — comment frame sent during idle gaps to keep proxies from closing the connection

Exactly one terminal frame (`done` or `error`) is sent. Failures detected before the
response starts are returned as a normal JSON error with an appropriate status code;
failures after streaming has begun arrive as an `error` frame on a 200 response.
"""


def add_chat_endpoint(result, generator, request, public):  # noqa: ARG001 -- hook signature
    result.setdefault("paths", {})[CHAT_PATH] = {
        "post": {
            "operationId": "chat_create",
            "description": _SSE_DESCRIPTION,
            "summary": "Send a message and stream the reply",
            "tags": ["chat"],
            "security": [{"jwtAuth": []}],
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": ["message"],
                            "properties": {
                                "message": {"type": "string", "maxLength": 32000},
                                "conversation_id": {
                                    "type": "string",
                                    "format": "uuid",
                                    "nullable": True,
                                    "description": "Omit to start a new conversation.",
                                },
                                "idempotency_key": {"type": "string", "maxLength": 128},
                            },
                        },
                        "example": {"conversation_id": None, "message": "Explain React hooks"},
                    }
                },
            },
            "responses": {
                "200": {
                    "description": "SSE stream of the reply.",
                    "content": {"text/event-stream": {"schema": {"type": "string"}}},
                },
                "400": {"description": "Malformed JSON or a failed field validation."},
                "401": {"description": "Missing or invalid bearer token."},
                "404": {"description": "The conversation does not exist for this user."},
                "413": {"description": "The message or conversation exceeds the context budget."},
                "429": {"description": "Rate limited. See the Retry-After header."},
                "502": {"description": "The AI service could not be reached."},
                "504": {"description": "The AI service timed out."},
            },
        }
    }
    return result
