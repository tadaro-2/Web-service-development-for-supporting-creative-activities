from django.conf import settings
from django.db import models


class Challenge(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    cover = models.FileField(upload_to="challenge_covers/", blank=True, null=True)
    # Необязательные параметры испытания (см. валидацию при публикации).
    duration_days = models.PositiveIntegerField(null=True, blank=True)
    required_publications = models.PositiveIntegerField(null=True, blank=True)
    date_start = models.DateField(null=True, blank=True)
    date_end = models.DateField(null=True, blank=True)
    # Название награды (создаётся/привязывается achievement при публикации челленджа).
    reward_title = models.CharField(max_length=255, blank=True, default="")
    achievement = models.ForeignKey(
        "Achievement",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="challenges",
    )
    is_published = models.BooleanField(default=False, db_index=True)
    # Когда испытание в последний раз вывели на сайт (для истории; при снятии с публикации не очищается).
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "challenge"

    def __str__(self) -> str:
        return self.title


class ChallengeParticipation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="challenge_participations",
    )
    challenge = models.ForeignKey(
        Challenge,
        on_delete=models.CASCADE,
        related_name="participations",
    )
    start_date = models.DateField()
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "challenge_participation"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "challenge"],
                name="uniq_user_challenge_participation",
            ),
        ]

    def __str__(self) -> str:
        return f"Participation({self.user_id}, {self.challenge_id})"


class ChallengeDay(models.Model):
    participation = models.ForeignKey(
        ChallengeParticipation,
        on_delete=models.CASCADE,
        related_name="days",
    )
    day_number = models.PositiveIntegerField()
    # Для режима по календарным дням; иначе null.
    slot_date = models.DateField(null=True, blank=True)
    post = models.ForeignKey(
        "platform_app.Post",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="challenge_day_slots",
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "challenge_day"
        constraints = [
            models.UniqueConstraint(
                fields=["participation", "day_number"],
                name="uniq_participation_day",
            ),
        ]

    def __str__(self) -> str:
        return f"Day {self.day_number} ({self.participation_id})"


class Achievement(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "achievement"

    def __str__(self) -> str:
        return self.title


class UserAchievement(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_achievements",
    )
    achievement = models.ForeignKey(
        Achievement,
        on_delete=models.CASCADE,
        related_name="user_links",
    )
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_achievement"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "achievement"],
                name="uniq_user_achievement",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.achievement_id}"


class DailyActivity(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="daily_activities",
    )
    date = models.DateField(db_index=True)

    class Meta:
        db_table = "daily_activity"
        constraints = [
            models.UniqueConstraint(fields=["user", "date"], name="uniq_user_daily_activity"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} @ {self.date}"
