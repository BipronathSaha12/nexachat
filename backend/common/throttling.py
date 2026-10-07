"""Server-side rate limits (PRD 12). Redis backed via the default cache."""

from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle


class ScopedUserRateThrottle(UserRateThrottle):
    """Per-user limit driven by the view's `throttle_scope`, falling back to `auth`."""

    scope = "auth"

    def __init__(self):
        # Rate is resolved per-request in allow_request, not at import time.
        pass

    def allow_request(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return True  # AnonRateThrottle owns anonymous traffic.
        self.scope = getattr(view, "throttle_scope", None) or "auth"
        self.rate = self.get_rate()
        self.num_requests, self.duration = self.parse_rate(self.rate)
        return super().allow_request(request, view)


class ChatBurstThrottle(SimpleRateThrottle):
    """Short-window limit protecting the Gemini quota from a single user."""

    scope = "chat_minute"

    def get_cache_key(self, request, view):  # noqa: ARG002 -- DRF throttle signature
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


class ChatDailyThrottle(SimpleRateThrottle):
    """Daily budget cap -- the real defence against cost blowout."""

    scope = "chat_day"

    def get_cache_key(self, request, view):  # noqa: ARG002 -- DRF throttle signature
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}
