from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("platform_app", "0011_palettecolor_label"),
    ]

    operations = [
        migrations.CreateModel(
            name="AiModelSetting",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("singleton_key", models.CharField(default="openai_model", max_length=64, unique=True)),
                ("model_name", models.CharField(default="gpt-4o-mini", max_length=128)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "ai_model_setting",
            },
        ),
    ]
