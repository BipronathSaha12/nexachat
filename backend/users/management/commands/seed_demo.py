"""Create or refresh the public demo account.

The credentials are published on the login page, so this account is deliberately
shared and disposable. Running the command again resets the password and, with
--reset, clears whatever the last visitor left behind.
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from conversations.models import Conversation

User = get_user_model()

DEFAULT_EMAIL = "demo@devtechguru.cloud"
DEFAULT_PASSWORD = "TryTheChatbot!2026"


class Command(BaseCommand):
    help = "Create or refresh the public demo account."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=DEFAULT_EMAIL)
        parser.add_argument("--password", default=DEFAULT_PASSWORD)
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Also delete the account's conversations, so the next visitor starts clean.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        email = options["email"].lower().strip()
        password = options["password"]

        user, created = User.objects.get_or_create(
            email=email,
            defaults={"display_name": "Demo User", "email_verified": True},
        )

        # Always reset the password: the whole point is that the published
        # credentials keep working even if someone changes them.
        user.set_password(password)
        user.is_active = True
        user.display_name = user.display_name or "Demo User"
        user.save()

        if options["reset"]:
            deleted, _ = Conversation.objects.filter(user=user).delete()
            self.stdout.write(f"cleared {deleted} conversation rows")

        verb = "created" if created else "refreshed"
        self.stdout.write(self.style.SUCCESS(f"demo account {verb}: {email}"))
