"""Shared fixtures. No test in the default run is allowed to reach the network."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from conversations.models import Conversation, Message

User = get_user_model()


@pytest.fixture
def password():
    return "correct-horse-battery-staple"


@pytest.fixture
def user(db, password):
    return User.objects.create_user(email="alice@example.com", password=password, display_name="Alice")


@pytest.fixture
def other_user(db, password):
    return User.objects.create_user(email="bob@example.com", password=password)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def auth_api(api, user):
    token = RefreshToken.for_user(user).access_token
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return api


@pytest.fixture
def conversation(db, user):
    return Conversation.objects.create(user=user, title="Existing conversation")


@pytest.fixture
def conversation_with_history(conversation):
    Message.objects.create(conversation=conversation, role=Message.Role.USER, content="Hello")
    Message.objects.create(conversation=conversation, role=Message.Role.ASSISTANT, content="Hi there")
    return conversation


@pytest.fixture
def auth_client(client, user):
    """Plain Django test client with a bearer token -- the chat view is not a DRF view."""
    token = RefreshToken.for_user(user).access_token
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {token}"
    return client
