from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("platform_app", "0003_alter_user_managers_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="onboarding_completed",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="onboarding_completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

