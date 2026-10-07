"""Shared model base classes."""

import uuid

from django.db import models


class UUIDModel(models.Model):
    """UUID primary keys: safe to expose in URLs, no enumeration of other users' rows."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
