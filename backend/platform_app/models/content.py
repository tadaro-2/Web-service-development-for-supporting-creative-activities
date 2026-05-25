from django.conf import settings
from django.db import models


class Tag(models.Model):
    name = models.CharField(max_length=64, unique=True)
    category = models.CharField(max_length=64, blank=True, db_index=True)

    class Meta:
        db_table = "tag"

    def __str__(self) -> str:
        return self.name


class Post(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posts",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    # pending — на модерации; published — в ленте; rejected — отклонено; draft — устаревшее/черновик
    status = models.CharField(max_length=32, default="pending", db_index=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Момент публикации в ленте (выставляется при одобрении модератором)
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "post"
        ordering = ["-created_at"]
        indexes = [
            # Frequent pattern: feed of published posts ordered by time.
            models.Index(fields=["status", "-published_at"], name="post_status_pub_at_idx"),
            # Frequent pattern: author's profile posts ordered by time.
            models.Index(fields=["author", "-created_at"], name="post_author_created_idx"),
        ]

    def __str__(self) -> str:
        return self.title


class Comment(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "comment"
        ordering = ["created_at"]
        indexes = [
            # Frequent pattern: comments for a post ordered by time.
            models.Index(fields=["post", "created_at"], name="comment_post_created_idx"),
        ]

    def __str__(self) -> str:
        return f"Comment({self.pk}) on {self.post_id}"


class Media(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="media_items",
    )
    type = models.CharField(max_length=32, db_index=True)
    url = models.URLField(max_length=2048, blank=True, default="")
    # Загрузка файла (приоритет над url при отдаче в API)
    image = models.FileField(upload_to="post_images/", blank=True, null=True)

    class Meta:
        db_table = "media"
        verbose_name_plural = "media"

    def __str__(self) -> str:
        return f"{self.type}:{self.pk}"


class PostMedia(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="post_media_links")
    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="post_links")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "post_media"
        constraints = [
            models.UniqueConstraint(fields=["post", "media"], name="uniq_post_media"),
        ]
        ordering = ["order", "pk"]

    def __str__(self) -> str:
        return f"PostMedia({self.post_id}, {self.media_id})"


class Material(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="materials",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=64, db_index=True)
    external_url = models.URLField(max_length=2048, blank=True, default="")
    # Автор контента (книги, курса и т.д.), не путать с author (кто добавил запись в систему)
    content_author = models.CharField(max_length=255, blank=True, default="")
    # [{"label": "ВКонтакте", "url": "https://..."}, ...]
    author_social_links = models.JSONField(default=list, blank=True)
    # Превью-обложка (og:image со страницы external_url или прямой URL картинки)
    cover_url = models.URLField(max_length=2048, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "material"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class MaterialTag(models.Model):
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name="material_tags")
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="material_links")

    class Meta:
        db_table = "material_tag"
        constraints = [
            models.UniqueConstraint(fields=["material", "tag"], name="uniq_material_tag"),
        ]

    def __str__(self) -> str:
        return f"{self.material_id}:{self.tag_id}"


class UserTag(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_tags",
    )
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="user_links")

    class Meta:
        db_table = "user_tag"
        constraints = [
            models.UniqueConstraint(fields=["user", "tag"], name="uniq_user_tag"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.tag_id}"


class PostTag(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="post_tags")
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="post_links")

    class Meta:
        db_table = "post_tag"
        constraints = [
            models.UniqueConstraint(fields=["post", "tag"], name="uniq_post_tag"),
        ]

    def __str__(self) -> str:
        return f"{self.post_id}:{self.tag_id}"


class Like(models.Model):
    """Polymorphic like: entity_type + entity_id (application-level resolution)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="likes",
    )
    entity_type = models.CharField(max_length=32, db_index=True)
    entity_id = models.PositiveBigIntegerField()

    class Meta:
        db_table = "like"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "entity_type", "entity_id"],
                name="uniq_like_entity",
            ),
        ]
        indexes = [
            # Feed decoration / counters: count likes by entity.
            models.Index(fields=["entity_type", "entity_id"], name="like_entity_idx"),
            # "My likes" lookups often filter by user+type.
            models.Index(fields=["user", "entity_type"], name="like_user_type_idx"),
        ]

    def __str__(self) -> str:
        return f"Like({self.entity_type}:{self.entity_id})"


class Bookmark(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bookmarks",
    )
    entity_type = models.CharField(max_length=32, db_index=True)
    entity_id = models.PositiveBigIntegerField()

    class Meta:
        db_table = "bookmark"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "entity_type", "entity_id"],
                name="uniq_bookmark_entity",
            ),
        ]
        indexes = [
            # Feed decoration / lookups: bookmarks by entity.
            models.Index(fields=["entity_type", "entity_id"], name="bookmark_entity_idx"),
            # "My bookmarks" typically filter by user+type and then order.
            models.Index(fields=["user", "entity_type", "-id"], name="bookmark_user_type_id_idx"),
        ]

    def __str__(self) -> str:
        return f"Bookmark({self.entity_type}:{self.entity_id})"
