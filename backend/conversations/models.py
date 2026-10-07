from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import TimeStampedModel, UUIDModel


class ConversationQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(deleted_at__isnull=True)

    def for_user(self, user):
        """Every read path goes through here -- PRD 11: users only see their own data."""
        return self.alive().filter(user=user)


class Conversation(UUIDModel, TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversations",
    )
    title = models.CharField(max_length=200, default="New conversation")
    system_instruction = models.TextField(blank=True)
    # Soft delete: a hard DELETE would drop message history a user may still be owed.
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = ConversationQuerySet.as_manager()

    class Meta:
        db_table = "conversations_conversation"
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user", "-updated_at"], name="conv_user_updated_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.user_id})"

    def soft_delete(self) -> None:
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def touch(self) -> None:
        """Bump updated_at so the sidebar orders by most recent activity."""
        self.save(update_fields=["updated_at"])


class Message(UUIDModel):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"
        SYSTEM = "system", "System"

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=16, choices=Role.choices)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    # Populated for assistant turns; drives the usage reporting in PRD 12.
    model = models.CharField(max_length=100, blank=True)
    input_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    thinking_tokens = models.PositiveIntegerField(null=True, blank=True)
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    finish_reason = models.CharField(max_length=40, blank=True)
    is_error = models.BooleanField(default=False)

    class Meta:
        db_table = "conversations_message"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["conversation", "created_at"], name="msg_conv_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.role}: {self.content[:40]}"
