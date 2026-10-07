import logging

from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.pagination import CursorPagePagination, MessageCursorPagination
from conversations.models import Conversation, Message
from conversations.serializers import (
    ConversationDetailSerializer,
    ConversationListSerializer,
    ConversationWriteSerializer,
    MessageSerializer,
)

logger = logging.getLogger("chatbot.conversations")


class ConversationViewSet(viewsets.ModelViewSet):
    """CRUD over the caller's own conversations (PRD 5.6).

    The queryset is user-scoped at the source, so there is no object-level
    permission to forget: another user's row is simply not visible.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = CursorPagePagination
    throttle_scope = "conversations"
    lookup_field = "pk"
    lookup_value_regex = "[0-9a-f-]{36}"

    def get_queryset(self):
        # Schema generation instantiates the view without a request.
        if getattr(self, "swagger_fake_view", False) or self.request is None:
            return Conversation.objects.none()
        qs = Conversation.objects.for_user(self.request.user)
        if self.action == "list":
            qs = qs.annotate(
                message_count=Count("messages", filter=~Q(messages__role=Message.Role.SYSTEM))
            )
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return ConversationListSerializer
        if self.action == "retrieve":
            return ConversationDetailSerializer
        return ConversationWriteSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        conversation = self.get_object()
        conversation.soft_delete()
        logger.info("conversation_deleted", extra={"conversation_id": str(conversation.pk)})
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(responses={200: MessageSerializer(many=True)})
    @action(detail=True, methods=["get"], pagination_class=MessageCursorPagination)
    def messages(self, request, pk=None):
        """Paged message history -- the detail endpoint inlines only the recent turns."""
        conversation = self.get_object()
        qs = conversation.messages.exclude(role=Message.Role.SYSTEM).order_by("created_at")
        page = self.paginate_queryset(qs)
        serializer = MessageSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)
