from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("platform_app", "0007_post_moderation_media_upload_material_tags"),
    ]

    operations = [
        migrations.AddField(
            model_name="material",
            name="content_author",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="material",
            name="author_social_links",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
