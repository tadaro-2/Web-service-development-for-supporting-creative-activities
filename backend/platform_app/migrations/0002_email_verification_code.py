from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("platform_app", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="emailverification",
            name="token",
            field=models.CharField(db_index=True, max_length=16),
        ),
        migrations.AddField(
            model_name="emailverification",
            name="expires_at",
            field=models.DateTimeField(db_index=True, null=True, blank=True),
        ),
        migrations.AddIndex(
            model_name="emailverification",
            index=models.Index(fields=["user", "sent_at"], name="email_ver_user_sent_idx"),
        ),
    ]

