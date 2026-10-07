from django.contrib import admin

from chat.models import UsageRecord


@admin.register(UsageRecord)
class UsageRecordAdmin(admin.ModelAdmin):
    list_display = [
        "created_at", "user", "model", "outcome",
        "input_tokens", "output_tokens", "thinking_tokens", "latency_ms", "attempts",
    ]
    list_filter = ["outcome", "model", "used_fallback", "created_at"]
    search_fields = ["user__email", "request_id"]
    readonly_fields = [f.name for f in UsageRecord._meta.fields]
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
