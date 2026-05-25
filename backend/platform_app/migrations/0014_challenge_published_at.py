from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("platform_app", "0013_challenge_gamification"),
    ]

    operations = [
        migrations.AddField(
            model_name="challenge",
            name="published_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]
