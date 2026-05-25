import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("platform_app", "0006_alter_userprofile_avatar_filefield"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="rejection_reason",
            field=models.TextField(blank=True, default=""),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="post",
            name="status",
            field=models.CharField(db_index=True, default="pending", max_length=32),
        ),
        migrations.AlterField(
            model_name="media",
            name="url",
            field=models.URLField(blank=True, default="", max_length=2048),
        ),
        migrations.AddField(
            model_name="media",
            name="image",
            field=models.FileField(blank=True, null=True, upload_to="post_images/"),
        ),
        migrations.AddField(
            model_name="material",
            name="external_url",
            field=models.URLField(blank=True, default="", max_length=2048),
        ),
        migrations.CreateModel(
            name="MaterialTag",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "material",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="material_tags",
                        to="platform_app.material",
                    ),
                ),
                (
                    "tag",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="material_links",
                        to="platform_app.tag",
                    ),
                ),
            ],
            options={
                "db_table": "material_tag",
            },
        ),
        migrations.AddConstraint(
            model_name="materialtag",
            constraint=models.UniqueConstraint(fields=("material", "tag"), name="uniq_material_tag"),
        ),
    ]
