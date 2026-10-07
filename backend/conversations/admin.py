from django.contrib import admin

from conversations.models import Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ["id", "role", "content", "created_at", "model", "input_tokens", "output_tokens"]
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["title", "user", "created_at", "updated_at", "deleted_at"]
    list_filter = ["created_at", "deleted_at"]
    search_fields = ["title", "user__email"]
    readonly_fields = ["id", "created_at", "updated_at"]
    raw_id_fields = ["user"]
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["id", "conversation", "role", "model", "input_tokens", "output_tokens", "created_at"]
    list_filter = ["role", "is_error", "model", "created_at"]
    search_fields = ["conversation__title"]
    readonly_fields = [f.name for f in Message._meta.fields]
    raw_id_fields = ["conversation"]

    def has_add_permission(self, request):
        return False
