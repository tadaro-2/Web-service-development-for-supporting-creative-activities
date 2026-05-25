from django.contrib import admin

from platform_app.models import (
    Achievement,
    AiGeneration,
    Bookmark,
    Challenge,
    ChallengeDay,
    ChallengeParticipation,
    Comment,
    DailyActivity,
    EmailVerification,
    Like,
    Material,
    MaterialTag,
    Media,
    Palette,
    PaletteColor,
    Post,
    PostMedia,
    PostTag,
    Tag,
    User,
    UserAchievement,
    UserProfile,
    UserSession,
    UserTag,
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    ordering = ("email",)
    list_display = ("email", "role", "email_verified", "is_staff", "is_active", "date_joined")
    list_filter = ("is_staff", "is_active", "email_verified", "role")
    search_fields = ("email",)
    readonly_fields = ("date_joined", "last_login")
    fieldsets = (
        (None, {"fields": ("email",)}),
        (
            "Права",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Дополнительно", {"fields": ("role", "email_verified", "date_joined", "last_login")}),
    )


admin.site.register(UserProfile)
admin.site.register(EmailVerification)
admin.site.register(UserSession)
admin.site.register(Tag)
admin.site.register(Post)
admin.site.register(Comment)
admin.site.register(Media)
admin.site.register(PostMedia)
admin.site.register(Material)
admin.site.register(MaterialTag)
admin.site.register(UserTag)
admin.site.register(PostTag)
admin.site.register(Like)
admin.site.register(Bookmark)
admin.site.register(AiGeneration)
admin.site.register(Palette)
admin.site.register(PaletteColor)
admin.site.register(Challenge)
admin.site.register(ChallengeParticipation)
admin.site.register(ChallengeDay)
admin.site.register(Achievement)
admin.site.register(UserAchievement)
admin.site.register(DailyActivity)
