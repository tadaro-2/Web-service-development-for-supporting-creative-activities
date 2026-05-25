# Generated manually for challenge + achievement flow

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("platform_app", "0012_aimodelsetting"),
    ]

    operations = [
        migrations.AddField(
            model_name="challenge",
            name="cover",
            field=models.FileField(blank=True, null=True, upload_to="challenge_covers/"),
        ),
        migrations.AlterField(
            model_name="challenge",
            name="duration_days",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="challenge",
            name="required_publications",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="challenge",
            name="date_start",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="challenge",
            name="date_end",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="challenge",
            name="reward_title",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="challenge",
            name="achievement",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="challenges",
                to="platform_app.achievement",
            ),
        ),
        migrations.AddField(
            model_name="challenge",
            name="is_published",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="challenge",
            name="created_at",
            field=models.DateTimeField(default=django.utils.timezone.now, editable=False),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="challenge",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True),
        ),
        migrations.AddField(
            model_name="challenge",
            name="updated_at",
            field=models.DateTimeField(default=django.utils.timezone.now, editable=False),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="challenge",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name="challengeparticipation",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="challengeday",
            name="slot_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="challengeday",
            name="post",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="challenge_day_slots",
                to="platform_app.post",
            ),
        ),
    ]
