"""Cursor pagination -- stable under concurrent inserts, unlike offset paging."""

from rest_framework.pagination import CursorPagination


class CursorPagePagination(CursorPagination):
    page_size = 25
    max_page_size = 100
    page_size_query_param = "page_size"
    ordering = "-updated_at"


class MessageCursorPagination(CursorPagination):
    page_size = 50
    max_page_size = 200
    page_size_query_param = "page_size"
    ordering = "created_at"
