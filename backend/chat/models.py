"""Usage accounting (PRD 12).

Kept separate from Message so a failed or blocked request is still recorded --
those are exactly the rows you need when diagnosing cost and error spikes.
"""

from django.conf import settings
from django.db import models

from common.models import UUIDModel


class UsageRecord(UUIDModel):
    class Outcome(models.TextChoices):
        SUCCESS = "success", "Success"
        ERROR = "error", "Error"
        BLOCKED = "blocked", "Blocked by safety filter"
        CANCELLED = "cancelled", "Cancelled by client"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="usage_records"
    )
    conversation = models.ForeignKey(
        "conversations.Conversation", on_delete=models.SET_NULL, null=True, related_name="usage_records"
    )

    model = models.CharField(max_length=100)
    used_fallback = models.BooleanField(default=False)
    outcome = models.CharField(max_length=16, choices=Outcome.choices, db_index=True)
    error_code = models.CharField(max_length=64, blank=True)

    request_count = models.PositiveSmallIntegerField(default=1)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    thinking_tokens = models.PositiveIntegerField(default=0)

    latency_ms = models.PositiveIntegerField(default=0)
    first_token_ms = models.PositiveIntegerField(default=0)
    attempts = models.PositiveSmallIntegerField(default=1)

    request_id = models.CharField(max_length=64, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "chat_usage_record"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="usage_user_created_idx"),
            models.Index(fields=["model", "-created_at"], name="usage_model_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.model} {self.outcome} in={self.input_tokens} out={self.output_tokens}"

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens + self.thinking_tokens
