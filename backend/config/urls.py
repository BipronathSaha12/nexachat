from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from common.views import liveness, readiness


def not_found(request, exception=None):
    return JsonResponse(
        {"error": {"code": "not_found", "message": "The requested resource does not exist."}},
        status=404,
    )


def server_error(request):
    return JsonResponse(
        {"error": {"code": "internal_error", "message": "Something went wrong. Please try again."}},
        status=500,
    )


handler404 = "config.urls.not_found"
handler500 = "config.urls.server_error"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz/", liveness, name="liveness"),
    path("readyz/", readiness, name="readiness"),
    path("api/auth/", include("users.urls")),
    path("api/conversations/", include("conversations.urls")),
    path("api/chat/", include("chat.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

if settings.DEBUG:
    from django.conf.urls.static import static

    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
