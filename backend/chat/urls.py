from django.urls import path

from chat.views import ChatStreamView

app_name = "chat"

urlpatterns = [
    path("", ChatStreamView.as_view(), name="stream"),
]
