# Initial migration for platform_app (Django + PostgreSQL schema from project ERD).

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("password", models.CharField(max_length=128, verbose_name="password")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                (
                    "is_superuser",
                    models.BooleanField(
                        default=False,
                        help_text="Designates that this user has all permissions without explicitly assigning them.",
                        verbose_name="superuser status",
                    ),
                ),
                ("first_name", models.CharField(blank=True, max_length=150, verbose_name="first name")),
                ("last_name", models.CharField(blank=True, max_length=150, verbose_name="last name")),
                (
                    "is_staff",
                    models.BooleanField(
                        default=False,
                        help_text="Designates whether the user can log into this admin site.",
                        verbose_name="staff status",
                    ),
                ),
                (
                    "is_active",
                    models.BooleanField(
                        default=True,
                        help_text="Designates whether this user should be treated as active.",
                        verbose_name="active",
                    ),
                ),
                ("date_joined", models.DateTimeField(default=django.utils.timezone.now, verbose_name="date joined")),
                ("email", models.EmailField(max_length=254, unique=True, verbose_name="email address")),
                ("role", models.CharField(db_index=True, default="user", max_length=64)),
                ("email_verified", models.BooleanField(default=False)),
                (
                    "groups",
                    models.ManyToManyField(
                        blank=True,
                        help_text="The groups this user belongs to.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.group",
                        verbose_name="groups",
                    ),
                ),
                (
                    "user_permissions",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Specific permissions for this user.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.permission",
                        verbose_name="user permissions",
                    ),
                ),
            ],
            options={
                "db_table": "user",
                "ordering": ["-date_joined"],
            },
        ),
        migrations.CreateModel(
            name="Achievement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
            ],
            options={"db_table": "achievement"},
        ),
        migrations.CreateModel(
            name="Challenge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("duration_days", models.PositiveIntegerField(default=1)),
            ],
            options={"db_table": "challenge"},
        ),
        migrations.CreateModel(
            name="Tag",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=64, unique=True)),
                ("category", models.CharField(blank=True, db_index=True, max_length=64)),
            ],
            options={"db_table": "tag"},
        ),
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name="profile",
                        serialize=False,
                        to="platform_app.user",
                    ),
                ),
                ("nickname", models.CharField(blank=True, max_length=128)),
                ("bio", models.TextField(blank=True)),
                ("level", models.CharField(blank=True, max_length=64)),
            ],
            options={"db_table": "user_profile"},
        ),
        migrations.CreateModel(
            name="EmailVerification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(db_index=True, max_length=128, unique=True)),
                ("sent_at", models.DateTimeField(auto_now_add=True)),
                ("verified_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="email_verifications",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "email_verification"},
        ),
        migrations.CreateModel(
            name="UserSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sessions",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "user_session"},
        ),
        migrations.CreateModel(
            name="Post",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("status", models.CharField(db_index=True, default="draft", max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="posts",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "post", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Comment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="platform_app.user",
                    ),
                ),
                (
                    "post",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="platform_app.post",
                    ),
                ),
            ],
            options={"db_table": "comment", "ordering": ["created_at"]},
        ),
        migrations.CreateModel(
            name="Media",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("type", models.CharField(db_index=True, max_length=32)),
                ("url", models.URLField(max_length=2048)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="media_items",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "media", "verbose_name_plural": "media"},
        ),
        migrations.CreateModel(
            name="PostMedia",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order", models.PositiveSmallIntegerField(default=0)),
                (
                    "media",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="post_links",
                        to="platform_app.media",
                    ),
                ),
                (
                    "post",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="post_media_links",
                        to="platform_app.post",
                    ),
                ),
            ],
            options={"db_table": "post_media", "ordering": ["order", "pk"]},
        ),
        migrations.CreateModel(
            name="Material",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("type", models.CharField(db_index=True, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="materials",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "material", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="UserTag",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "tag",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_links",
                        to="platform_app.tag",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_tags",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "user_tag"},
        ),
        migrations.CreateModel(
            name="PostTag",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "post",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="post_tags",
                        to="platform_app.post",
                    ),
                ),
                (
                    "tag",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="post_links",
                        to="platform_app.tag",
                    ),
                ),
            ],
            options={"db_table": "post_tag"},
        ),
        migrations.CreateModel(
            name="Like",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("entity_type", models.CharField(db_index=True, max_length=32)),
                ("entity_id", models.PositiveBigIntegerField()),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="likes",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "like"},
        ),
        migrations.CreateModel(
            name="Bookmark",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("entity_type", models.CharField(db_index=True, max_length=32)),
                ("entity_id", models.PositiveBigIntegerField()),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="bookmarks",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "bookmark"},
        ),
        migrations.CreateModel(
            name="AiGeneration",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("type", models.CharField(db_index=True, max_length=64)),
                ("input_text", models.TextField()),
                ("result_text", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ai_generations",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "ai_generation", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Palette",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("description", models.TextField(blank=True)),
                ("source", models.CharField(blank=True, max_length=128)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="palettes",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "palette"},
        ),
        migrations.CreateModel(
            name="PaletteColor",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("color_hex", models.CharField(max_length=16)),
                (
                    "palette",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="colors",
                        to="platform_app.palette",
                    ),
                ),
            ],
            options={"db_table": "palette_color", "ordering": ["pk"]},
        ),
        migrations.CreateModel(
            name="ChallengeParticipation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("start_date", models.DateField()),
                (
                    "challenge",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="participations",
                        to="platform_app.challenge",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="challenge_participations",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "challenge_participation"},
        ),
        migrations.CreateModel(
            name="ChallengeDay",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("day_number", models.PositiveIntegerField()),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "participation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="days",
                        to="platform_app.challengeparticipation",
                    ),
                ),
            ],
            options={"db_table": "challenge_day"},
        ),
        migrations.CreateModel(
            name="UserAchievement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("received_at", models.DateTimeField(auto_now_add=True)),
                (
                    "achievement",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_links",
                        to="platform_app.achievement",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_achievements",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "user_achievement"},
        ),
        migrations.CreateModel(
            name="DailyActivity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField(db_index=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="daily_activities",
                        to="platform_app.user",
                    ),
                ),
            ],
            options={"db_table": "daily_activity"},
        ),
        migrations.AddConstraint(
            model_name="usertag",
            constraint=models.UniqueConstraint(fields=("user", "tag"), name="uniq_user_tag"),
        ),
        migrations.AddConstraint(
            model_name="posttag",
            constraint=models.UniqueConstraint(fields=("post", "tag"), name="uniq_post_tag"),
        ),
        migrations.AddConstraint(
            model_name="like",
            constraint=models.UniqueConstraint(
                fields=("user", "entity_type", "entity_id"),
                name="uniq_like_entity",
            ),
        ),
        migrations.AddConstraint(
            model_name="bookmark",
            constraint=models.UniqueConstraint(
                fields=("user", "entity_type", "entity_id"),
                name="uniq_bookmark_entity",
            ),
        ),
        migrations.AddConstraint(
            model_name="challengeparticipation",
            constraint=models.UniqueConstraint(
                fields=("user", "challenge"),
                name="uniq_user_challenge_participation",
            ),
        ),
        migrations.AddConstraint(
            model_name="challengeday",
            constraint=models.UniqueConstraint(
                fields=("participation", "day_number"),
                name="uniq_participation_day",
            ),
        ),
        migrations.AddConstraint(
            model_name="userachievement",
            constraint=models.UniqueConstraint(
                fields=("user", "achievement"),
                name="uniq_user_achievement",
            ),
        ),
        migrations.AddConstraint(
            model_name="dailyactivity",
            constraint=models.UniqueConstraint(fields=("user", "date"), name="uniq_user_daily_activity"),
        ),
        migrations.AddConstraint(
            model_name="postmedia",
            constraint=models.UniqueConstraint(fields=("post", "media"), name="uniq_post_media"),
        ),
    ]
