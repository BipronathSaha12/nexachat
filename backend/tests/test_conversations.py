import pytest
from django.urls import reverse

from conversations.models import Conversation, Message

pytestmark = pytest.mark.django_db


def test_list_requires_authentication(api):
    assert api.get(reverse("conversations:conversation-list")).status_code == 401


def test_list_returns_only_own_conversations(auth_api, user, other_user):
    Conversation.objects.create(user=user, title="Mine")
    Conversation.objects.create(user=other_user, title="Theirs")

    response = auth_api.get(reverse("conversations:conversation-list"))
    assert response.status_code == 200
    titles = [c["title"] for c in response.data["results"]]
    assert titles == ["Mine"]


def test_retrieving_another_users_conversation_is_404_not_403(auth_api, other_user):
    """A 403 would confirm the row exists. 404 leaks nothing."""
    theirs = Conversation.objects.create(user=other_user, title="Secret")
    url = reverse("conversations:conversation-detail", args=[theirs.pk])
    assert auth_api.get(url).status_code == 404


def test_create_conversation_assigns_caller_as_owner(auth_api, user):
    response = auth_api.post(
        reverse("conversations:conversation-list"), {"title": "Fresh"}, format="json"
    )
    assert response.status_code == 201
    assert Conversation.objects.get(pk=response.data["id"]).user == user


def test_create_rejects_blank_title(auth_api):
    response = auth_api.post(
        reverse("conversations:conversation-list"), {"title": "   "}, format="json"
    )
    assert response.status_code == 400


def test_rename_conversation(auth_api, conversation):
    url = reverse("conversations:conversation-detail", args=[conversation.pk])
    response = auth_api.patch(url, {"title": "Renamed"}, format="json")
    assert response.status_code == 200
    conversation.refresh_from_db()
    assert conversation.title == "Renamed"


def test_cannot_rename_another_users_conversation(auth_api, other_user):
    theirs = Conversation.objects.create(user=other_user, title="Secret")
    url = reverse("conversations:conversation-detail", args=[theirs.pk])
    assert auth_api.patch(url, {"title": "Hacked"}, format="json").status_code == 404
    theirs.refresh_from_db()
    assert theirs.title == "Secret"


def test_delete_is_a_soft_delete(auth_api, conversation_with_history):
    url = reverse("conversations:conversation-detail", args=[conversation_with_history.pk])
    assert auth_api.delete(url).status_code == 204

    conversation_with_history.refresh_from_db()
    assert conversation_with_history.deleted_at is not None
    # History survives, but the row is gone from every user-facing queryset.
    assert conversation_with_history.messages.count() == 2
    assert auth_api.get(url).status_code == 404


def test_detail_includes_messages_in_order_and_hides_system_turns(auth_api, conversation):
    Message.objects.create(conversation=conversation, role=Message.Role.SYSTEM, content="internal")
    Message.objects.create(conversation=conversation, role=Message.Role.USER, content="first")
    Message.objects.create(conversation=conversation, role=Message.Role.ASSISTANT, content="second")

    response = auth_api.get(reverse("conversations:conversation-detail", args=[conversation.pk]))
    contents = [m["content"] for m in response.data["messages"]]
    assert contents == ["first", "second"]


def test_messages_endpoint_is_scoped_and_paginated(auth_api, conversation_with_history):
    url = reverse("conversations:conversation-messages", args=[conversation_with_history.pk])
    response = auth_api.get(url)
    assert response.status_code == 200
    assert len(response.data["results"]) == 2


def test_list_reports_message_count_excluding_system(auth_api, conversation):
    Message.objects.create(conversation=conversation, role=Message.Role.SYSTEM, content="x")
    Message.objects.create(conversation=conversation, role=Message.Role.USER, content="y")

    response = auth_api.get(reverse("conversations:conversation-list"))
    assert response.data["results"][0]["message_count"] == 1
