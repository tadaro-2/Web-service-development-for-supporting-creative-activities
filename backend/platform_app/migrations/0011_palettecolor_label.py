from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("platform_app", "0010_post_published_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="palettecolor",
            name="label",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
    ]
