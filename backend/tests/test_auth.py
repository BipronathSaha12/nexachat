import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

User = get_user_model()
pytestmark = pytest.mark.django_db


def test_register_creates_user_and_returns_tokens(api):
    response = api.post(
        reverse("users:register"),
        {"email": "New@Example.com", "password": "correct-horse-battery-staple", "display_name": "New"},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert set(response.data) == {"user", "access", "refresh"}
    # Email is normalised to lowercase so logins cannot fork on case.
    assert response.data["user"]["email"] == "new@example.com"
    assert User.objects.filter(email="new@example.com").exists()


def test_register_never_returns_the_password(api):
    response = api.post(
        reverse("users:register"),
        {"email": "leak@example.com", "password": "correct-horse-battery-staple"},
        format="json",
    )
    assert "password" not in str(response.data)


def test_register_rejects_weak_password(api):
    response = api.post(
        reverse("users:register"), {"email": "weak@example.com", "password": "abc"}, format="json"
    )
    assert response.status_code == 400
    assert response.data["error"]["code"] == "validation_error"


def test_register_rejects_duplicate_email_case_insensitively(api, user):
    response = api.post(
        reverse("users:register"),
        {"email": "ALICE@example.com", "password": "correct-horse-battery-staple"},
        format="json",
    )
    assert response.status_code == 400


def test_login_returns_tokens_and_user(api, user, password):
    response = api.post(
        reverse("users:login"), {"email": user.email, "password": password}, format="json"
    )
    assert response.status_code == 200, response.data
    assert response.data["user"]["email"] == user.email
    assert response.data["access"]


def test_login_with_wrong_password_fails(api, user):
    response = api.post(
        reverse("users:login"), {"email": user.email, "password": "wrong-password"}, format="json"
    )
    assert response.status_code == 401
    assert response.data["error"]["code"] == "authentication_error"


def test_me_requires_authentication(api):
    assert api.get(reverse("users:me")).status_code == 401


def test_me_returns_the_caller(auth_api, user):
    response = auth_api.get(reverse("users:me"))
    assert response.status_code == 200
    assert response.data["email"] == user.email


def test_logout_blacklists_refresh_token(api, user, password):
    login = api.post(
        reverse("users:login"), {"email": user.email, "password": password}, format="json"
    )
    refresh = login.data["refresh"]
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    assert api.post(reverse("users:logout"), {"refresh": refresh}, format="json").status_code == 205

    # The blacklisted token must not mint a new access token.
    replay = api.post(reverse("users:refresh"), {"refresh": refresh}, format="json")
    assert replay.status_code == 401


def test_logout_is_idempotent(auth_api):
    response = auth_api.post(reverse("users:logout"), {"refresh": "not-a-real-token"}, format="json")
    assert response.status_code == 205
