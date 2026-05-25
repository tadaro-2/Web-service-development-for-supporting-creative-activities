from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("platform_app", "0005_userprofile_avatar_nickname_ci_unique"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userprofile",
            name="avatar",
            field=models.FileField(blank=True, null=True, upload_to="avatars/"),
        ),
    ]
