from django.db import migrations, models
import django.db.models.functions.text


class Migration(migrations.Migration):
    dependencies = [
        ("platform_app", "0004_userprofile_onboarding"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="avatar",
            field=models.ImageField(blank=True, null=True, upload_to="avatars/"),
        ),
        migrations.AlterField(
            model_name="userprofile",
            name="nickname",
            field=models.CharField(blank=True, db_index=True, max_length=128, null=True),
        ),
        migrations.AddConstraint(
            model_name="userprofile",
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Lower("nickname"),
                name="uniq_userprofile_nickname_ci",
            ),
        ),
    ]

