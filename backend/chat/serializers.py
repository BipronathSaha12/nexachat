from rest_framework import serializers

MAX_MESSAGE_CHARS = 32000


class ChatRequestSerializer(serializers.Serializer):
    """Validates POST /api/chat/ (PRD 10)."""

    conversation_id = serializers.UUIDField(required=False, allow_null=True)
    message = serializers.CharField(max_length=MAX_MESSAGE_CHARS, trim_whitespace=False)
    # Optional client-generated key so a retried POST cannot duplicate a turn.
    idempotency_key = serializers.CharField(required=False, allow_blank=True, max_length=128)

    def validate_message(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Message cannot be empty.")
        return value
