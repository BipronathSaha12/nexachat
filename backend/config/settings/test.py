"""Test settings: fast hashing, local-memory cache, no external calls."""

from .base import *  # noqa: F403

DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "chatbot-tests",
    }
}

# Throttles are exercised explicitly in their own tests, not globally.
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": ()}  # noqa: F405

GEMINI = {**GEMINI, "API_KEY": "test-key"}  # noqa: F405

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

LOGGING["root"]["level"] = "CRITICAL"  # noqa: F405
