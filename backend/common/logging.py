"""Structured logging: JSON in deployed environments, request id on every record."""

import json
import logging
from datetime import UTC, datetime

from common.context import get_request_id, get_user_id

# Keys already present on a LogRecord that must not be duplicated into `extra`.
_RESERVED = {
    "args", "asctime", "created", "exc_info", "exc_text", "filename", "funcName",
    "levelname", "levelno", "lineno", "module", "msecs", "message", "msg", "name",
    "pathname", "process", "processName", "relativeCreated", "stack_info",
    "thread", "threadName", "taskName", "request_id", "user_id",
}


class RequestIDFilter(logging.Filter):
    """Attach the current request id / user id to every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = getattr(record, "request_id", None) or get_request_id()
        record.user_id = getattr(record, "user_id", None) or get_user_id()
        return True


class JSONFormatter(logging.Formatter):
    """One JSON object per line -- what log shippers expect."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
            "user_id": getattr(record, "user_id", "-"),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)
