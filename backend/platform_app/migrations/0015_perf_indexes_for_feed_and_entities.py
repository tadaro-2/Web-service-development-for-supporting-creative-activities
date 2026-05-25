from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("platform_app", "0014_challenge_published_at"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="post",
            index=models.Index(fields=["status", "-published_at"], name="post_status_pub_at_idx"),
        ),
        migrations.AddIndex(
            model_name="post",
            index=models.Index(fields=["author", "-created_at"], name="post_author_created_idx"),
        ),
        migrations.AddIndex(
            model_name="comment",
            index=models.Index(fields=["post", "created_at"], name="comment_post_created_idx"),
        ),
        migrations.AddIndex(
            model_name="like",
            index=models.Index(fields=["entity_type", "entity_id"], name="like_entity_idx"),
        ),
        migrations.AddIndex(
            model_name="like",
            index=models.Index(fields=["user", "entity_type"], name="like_user_type_idx"),
        ),
        migrations.AddIndex(
            model_name="bookmark",
            index=models.Index(fields=["entity_type", "entity_id"], name="bookmark_entity_idx"),
        ),
        migrations.AddIndex(
            model_name="bookmark",
            index=models.Index(fields=["user", "entity_type", "-id"], name="bookmark_user_type_id_idx"),
        ),
    ]

