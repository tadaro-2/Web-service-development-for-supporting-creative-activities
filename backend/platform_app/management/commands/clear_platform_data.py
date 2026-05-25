"""
Удаляет пользовательский контент и активность, сохраняя:
- User, UserProfile, EmailVerification
- справочник Tag (строки tag не трогаются; связи user_tag / post_tag / material_tag очищаются)
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from platform_app.models import (
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


class Command(BaseCommand):
    help = (
        "Удаляет посты, медиа, материалы, лайки, закладки, ИИ-генерации, палитры, "
        "геймификацию пользователей и сессии. Сохраняет пользователей, профили, "
        "email_verification и все записи tag."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Только показать количество удаляемых строк, без изменений в БД.",
        )

    def handle(self, *args, **options):
        dry_run: bool = options["dry_run"]

        counts = {
            "challenge": Challenge.objects.count(),
            "challenge_day": ChallengeDay.objects.count(),
            "challenge_participation": ChallengeParticipation.objects.count(),
            "user_achievement": UserAchievement.objects.count(),
            "daily_activity": DailyActivity.objects.count(),
            "ai_generation": AiGeneration.objects.count(),
            "palette": Palette.objects.count(),
            "comment": Comment.objects.count(),
            "post_media": PostMedia.objects.count(),
            "post_tag": PostTag.objects.count(),
            "post": Post.objects.count(),
            "media": Media.objects.count(),
            "material_tag": MaterialTag.objects.count(),
            "material": Material.objects.count(),
            "like": Like.objects.count(),
            "bookmark": Bookmark.objects.count(),
            "user_tag": UserTag.objects.count(),
            "user_session": UserSession.objects.count(),
        }

        self.stdout.write("Будет затронуто (строки):")
        for k, v in counts.items():
            self.stdout.write(f"  {k}: {v}")

        keep = {
            "user": User.objects.count(),
            "user_profile": UserProfile.objects.count(),
            "email_verification": EmailVerification.objects.count(),
            "tag": Tag.objects.count(),
        }
        self.stdout.write("Сохраняется без изменений:")
        for k, v in keep.items():
            self.stdout.write(f"  {k}: {v}")

        if dry_run:
            self.stdout.write(self.style.WARNING("Режим --dry-run: БД не изменена."))
            return

        with transaction.atomic():
            ChallengeDay.objects.all().delete()
            ChallengeParticipation.objects.all().delete()
            Challenge.objects.all().delete()
            UserAchievement.objects.all().delete()
            DailyActivity.objects.all().delete()
            AiGeneration.objects.all().delete()
            Palette.objects.all().delete()

            Post.objects.all().delete()

            for media in Media.objects.iterator():
                if media.image:
                    media.image.delete(save=False)
            Media.objects.all().delete()

            Material.objects.all().delete()

            Like.objects.all().delete()
            Bookmark.objects.all().delete()
            UserTag.objects.all().delete()
            UserSession.objects.all().delete()

        self.stdout.write(self.style.SUCCESS("Готово: контент очищен, пользователи и теги сохранены."))
