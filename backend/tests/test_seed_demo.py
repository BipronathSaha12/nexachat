"""The demo account is published on the login page, so it must always be usable."""

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse

from conversations.models import Conversation, Message
from users.management.commands.seed_demo import DEFAULT_EMAIL, DEFAULT_PASSWORD

User = get_user_model()
pytestmark = pytest.mark.django_db


def test_creates_the_demo_account():
    call_command("seed_demo")
    user = User.objects.get(email=DEFAULT_EMAIL)
    assert user.check_password(DEFAULT_PASSWORD)
    assert user.is_active


def test_is_idempotent():
    call_command("seed_demo")
    call_command("seed_demo")
    assert User.objects.filter(email=DEFAULT_EMAIL).count() == 1


def test_restores_the_published_password_if_someone_changes_it():
    call_command("seed_demo")
    user = User.objects.get(email=DEFAULT_EMAIL)
    user.set_password("someone-hijacked-this")
    user.save()

    call_command("seed_demo")
    user.refresh_from_db()
    assert user.check_password(DEFAULT_PASSWORD)


def test_reactivates_a_disabled_demo_account():
    call_command("seed_demo")
    User.objects.filter(email=DEFAULT_EMAIL).update(is_active=False)
    call_command("seed_demo")
    assert User.objects.get(email=DEFAULT_EMAIL).is_active


def test_reset_clears_conversations():
    call_command("seed_demo")
    user = User.objects.get(email=DEFAULT_EMAIL)
    conversation = Conversation.objects.create(user=user, title="Left behind")
    Message.objects.create(conversation=conversation, role=Message.Role.USER, content="hi")

    call_command("seed_demo", "--reset")
    assert not Conversation.objects.filter(user=user).exists()


def test_reset_does_not_touch_other_users(other_user):
    call_command("seed_demo")
    theirs = Conversation.objects.create(user=other_user, title="Not mine to delete")
    call_command("seed_demo", "--reset")
    assert Conversation.objects.filter(pk=theirs.pk).exists()


def test_published_credentials_actually_log_in(api):
    call_command("seed_demo")
    response = api.post(
        reverse("users:login"),
        {"email": DEFAULT_EMAIL, "password": DEFAULT_PASSWORD},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["access"]
