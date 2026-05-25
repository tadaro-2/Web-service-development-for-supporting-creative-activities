from datetime import timedelta

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


def _default_email_verification_expires_at():
    return timezone.now() + timedelta(minutes=10)


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email: str, password: str | None = None, **extra):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        if extra.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self.create_user(email, password, **extra)


class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=64, default="user", db_index=True)
    email_verified = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    class Meta:
        db_table = "user"
        ordering = ["-date_joined"]

    def __str__(self) -> str:
        return self.email


class UserProfile(models.Model):
    user = models.OneToOneField(
        "platform_app.User",
        on_delete=models.CASCADE,
        related_name="profile",
        primary_key=True,
    )
    # Nullable so we can have a DB-level unique constraint without conflicts on empty string.
    nickname = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    bio = models.TextField(blank=True)
    level = models.CharField(max_length=64, blank=True)
    # FileField (not ImageField) so Pillow is optional; same storage, no image validation at ORM level.
    avatar = models.FileField(upload_to="avatars/", blank=True, null=True)
    onboarding_completed = models.BooleanField(default=False, db_index=True)
    onboarding_completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "user_profile"
        constraints = [
            models.UniqueConstraint(Lower("nickname"), name="uniq_userprofile_nickname_ci"),
        ]

    def __str__(self) -> str:
        return self.nickname or str(self.user_id)


class EmailVerification(models.Model):
    user = models.ForeignKey(
        "platform_app.User",
        on_delete=models.CASCADE,
        related_name="email_verifications",
    )
    # 6-digit verification code (stored as string to preserve leading zeros).
    token = models.CharField(max_length=16, db_index=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(db_index=True, default=_default_email_verification_expires_at)

    class Meta:
        db_table = "email_verification"
        indexes = [
            models.Index(fields=["user", "sent_at"]),
        ]

    def __str__(self) -> str:
        return f"EmailVerification({self.user_id})"

class UserSession(models.Model):
    user = models.ForeignKey(
        "platform_app.User",
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "user_session"

    def __str__(self) -> str:
        return f"Session({self.user_id}, {self.pk})"
