from rest_framework import serializers

from platform_app.models import (
    AiGeneration,
    AiModelSetting,
    Challenge,
    Comment,
    Material,
    MaterialTag,
    Media,
    Palette,
    Post,
    Tag,
    User,
    UserAchievement,
    UserProfile,
)


class UserPublicSerializer(serializers.ModelSerializer):
    onboarding_completed = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "role", "email_verified", "date_joined", "onboarding_completed", "is_admin")

    def get_is_admin(self, obj: User) -> bool:
        return bool(getattr(obj, "is_staff", False) or getattr(obj, "role", "") == "admin")

    def get_onboarding_completed(self, obj: User) -> bool:
        # Profiles may not exist for legacy users; treat as not completed.
        profile = getattr(obj, "profile", None)
        if profile is None:
            return False
        return bool(getattr(profile, "onboarding_completed", False))


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField()

    class Meta:
        model = User
        fields = ("email", "password", "role")

    def validate_email(self, value: str) -> str:
        # Normalize to reduce duplicates caused by case/whitespace differences.
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Пользователь с таким email уже зарегистрирован")
        return email

    def create(self, validated_data):
        password = validated_data.pop("password")
        email = validated_data.pop("email")
        user = User.objects.create_user(email, password, **validated_data)
        profile, _ = UserProfile.objects.get_or_create(user=user)
        # Default nickname shown in UI until the user edits it.
        if not profile.nickname:
            profile.nickname = f"user{user.id}"
            profile.save(update_fields=["nickname"])
        return user


class UserProfileMeSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    user_id = serializers.IntegerField(read_only=True)
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    achievements = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            "user_id",
            "email",
            "nickname",
            "display_name",
            "bio",
            "level",
            "avatar",
            "avatar_url",
            "onboarding_completed",
            "onboarding_completed_at",
            "achievements",
        )
        read_only_fields = (
            "user_id",
            "email",
            "display_name",
            "avatar_url",
            "onboarding_completed",
            "onboarding_completed_at",
            "achievements",
        )

    def get_display_name(self, obj: UserProfile) -> str:
        return obj.nickname or f"user{obj.user_id}"

    def get_avatar_url(self, obj: UserProfile) -> str | None:
        if not obj.avatar:
            return None
        return obj.avatar.url

    def get_achievements(self, obj: UserProfile) -> list[dict]:
        qs = UserAchievement.objects.filter(user_id=obj.user_id).select_related("achievement")
        return [
            {"id": ua.achievement_id, "title": ua.achievement.title, "received_at": ua.received_at}
            for ua in qs
        ]

    def validate_nickname(self, value: str | None) -> str | None:
        if value is None:
            return None
        nickname = value.strip()
        if nickname == "":
            return None
        if len(nickname) < 3:
            raise serializers.ValidationError("Ник должен быть минимум 3 символа")
        if len(nickname) > 32:
            raise serializers.ValidationError("Ник должен быть максимум 32 символа")
        # Basic allowed charset: letters, digits, underscore, dot, hyphen.
        import re

        if not re.fullmatch(r"[A-Za-z0-9_.-]+", nickname):
            raise serializers.ValidationError("Допустимы только латиница/цифры и символы _ . -")

        qs = UserProfile.objects.filter(nickname__iexact=nickname)
        if self.instance is not None:
            qs = qs.exclude(user_id=self.instance.user_id)
        if qs.exists():
            raise serializers.ValidationError("Этот ник уже занят")

        return nickname

    def update(self, instance: UserProfile, validated_data: dict) -> UserProfile:
        old_avatar = instance.avatar
        instance = super().update(instance, validated_data)
        if "avatar" in validated_data and old_avatar:
            old_name = old_avatar.name
            new_name = instance.avatar.name if instance.avatar else ""
            if old_name != new_name:
                old_avatar.delete(save=False)
        return instance


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=4, max_length=16)


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class AiGenerationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiGeneration
        fields = ("id", "type", "input_text", "result_text", "created_at")


class AiModelSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiModelSetting
        fields = ("model_name", "updated_at")


class AiModelSettingUpdateSerializer(serializers.Serializer):
    model_name = serializers.CharField(max_length=128, trim_whitespace=True)

    def validate_model_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Укажите название модели.")
        return name


class PaletteSerializer(serializers.ModelSerializer):
    colors = serializers.SerializerMethodField()

    class Meta:
        model = Palette
        fields = ("id", "description", "source", "colors")

    def get_colors(self, obj: Palette) -> list[dict]:
        return [
            {"hex": c.color_hex, "label": (c.label or "").strip()}
            for c in obj.colors.all()
        ]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("id", "name", "category")


class PostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = (
            "id",
            "author",
            "title",
            "description",
            "status",
            "rejection_reason",
            "created_at",
        )
        read_only_fields = ("id", "created_at", "author", "rejection_reason")


class AuthorMiniSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ("user_id", "nickname", "display_name", "avatar_url")

    def get_display_name(self, obj: UserProfile) -> str:
        return obj.nickname or f"user{obj.user_id}"

    def get_avatar_url(self, obj: UserProfile) -> str | None:
        if not obj.avatar:
            return None
        return obj.avatar.url


class MediaSerializer(serializers.ModelSerializer):
    display_url = serializers.SerializerMethodField()

    class Meta:
        model = Media
        fields = ("id", "type", "display_url")

    def get_display_url(self, obj: Media) -> str:
        if obj.image:
            return obj.image.url
        return obj.url


class CommentSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ("id", "text", "created_at", "author")
        read_only_fields = ("id", "created_at", "author")

    def get_author(self, obj: Comment) -> dict:
        profile = getattr(obj.author, "profile", None)
        if profile is None:
            profile, _ = UserProfile.objects.get_or_create(user=obj.author)
        return AuthorMiniSerializer(profile, context=self.context).data


class PostFeedSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    likes_count = serializers.IntegerField(read_only=True)
    comments_count = serializers.IntegerField(read_only=True)
    liked_by_me = serializers.BooleanField(read_only=True)
    bookmarked_by_me = serializers.BooleanField(read_only=True)

    class Meta:
        model = Post
        fields = (
            "id",
            "author",
            "title",
            "description",
            "status",
            "rejection_reason",
            "created_at",
            "published_at",
            "tags",
            "images",
            "likes_count",
            "comments_count",
            "liked_by_me",
            "bookmarked_by_me",
        )

    def get_author(self, obj: Post) -> dict:
        profile = getattr(obj.author, "profile", None)
        if profile is None:
            profile, _ = UserProfile.objects.get_or_create(user=obj.author)
        return AuthorMiniSerializer(profile, context=self.context).data

    def get_tags(self, obj: Post) -> list[dict]:
        tag_objs = [pt.tag for pt in obj.post_tags.select_related("tag").all()]
        return TagSerializer(tag_objs, many=True).data

    def get_images(self, obj: Post) -> list[dict]:
        links = (
            obj.post_media_links.select_related("media")
            .order_by("order", "pk")
        )
        out = []
        for link in links:
            out.append(MediaSerializer(link.media, context=self.context).data)
        return out


class MaterialSerializer(serializers.ModelSerializer):
    tags = serializers.SerializerMethodField()
    bookmarked_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Material
        fields = (
            "id",
            "title",
            "description",
            "type",
            "external_url",
            "cover_url",
            "content_author",
            "author_social_links",
            "created_at",
            "tags",
            "bookmarked_by_me",
        )

    def get_bookmarked_by_me(self, obj: Material) -> bool:
        return bool(getattr(obj, "_bookmarked", False))

    def get_tags(self, obj: Material) -> list[dict]:
        tag_objs = [mt.tag for mt in obj.material_tags.select_related("tag").all()]
        return TagSerializer(tag_objs, many=True).data


class MaterialCreateSerializer(serializers.ModelSerializer):
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        write_only=True,
    )
    title = serializers.CharField(max_length=255, trim_whitespace=True)
    description = serializers.CharField(trim_whitespace=True, min_length=10)
    external_url = serializers.URLField(max_length=2048)
    content_author = serializers.CharField(max_length=255, trim_whitespace=True)
    author_social_links = serializers.JSONField(required=False, default=list)

    class Meta:
        model = Material
        fields = (
            "title",
            "description",
            "type",
            "external_url",
            "content_author",
            "author_social_links",
            "tag_ids",
        )

    def validate_author_social_links(self, value) -> list:
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Ожидается список объектов {label, url}")
        if len(value) > 20:
            raise serializers.ValidationError("Не более 20 ссылок")
        out: list[dict[str, str]] = []
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError("Некорректный формат ссылки")
            label = (item.get("label") or "").strip()
            url = (item.get("url") or "").strip()
            if not label or not url:
                continue
            if len(url) > 2048:
                raise serializers.ValidationError("Слишком длинный URL")
            out.append({"label": label[:128], "url": url})
        return out

    def validate_tag_ids(self, value: list[int]) -> list[int]:
        if len(value) > 50:
            raise serializers.ValidationError("Слишком много тегов")
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Теги не должны повторяться")
        tags = list(Tag.objects.filter(id__in=value))
        if len(tags) != len(value):
            raise serializers.ValidationError("Указаны неизвестные теги")
        return value

    def create(self, validated_data: dict) -> Material:
        from platform_app.utils.cover_from_url import resolve_cover_from_url

        tag_ids = validated_data.pop("tag_ids")
        ext = str(validated_data.get("external_url") or "")
        cover = resolve_cover_from_url(ext)
        validated_data["cover_url"] = (cover or "")[:2048]
        request = self.context["request"]
        material = Material.objects.create(author=request.user, **validated_data)
        MaterialTag.objects.bulk_create(
            [MaterialTag(material=material, tag_id=tid) for tid in tag_ids],
            ignore_conflicts=True,
        )
        return material


class ChallengeCardSerializer(serializers.ModelSerializer):
    cover_url = serializers.SerializerMethodField()
    i_participate = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = (
            "id",
            "title",
            "description",
            "cover_url",
            "date_start",
            "date_end",
            "required_publications",
            "duration_days",
            "reward_title",
            "is_published",
            "published_at",
            "i_participate",
        )

    def get_i_participate(self, obj: Challenge) -> bool:
        ids = self.context.get("participating_challenge_ids")
        if not ids:
            return False
        return obj.id in ids

    def get_cover_url(self, obj: Challenge) -> str | None:
        if not obj.cover:
            return None
        url = obj.cover.url
        # Относительный /media/... — браузер грузит с того же origin, что и фронт (Vite proxy / ngrok).
        # build_absolute_uri давал http://127.0.0.1:8000/... при прокси и ломал картинки на телефоне.
        if isinstance(url, str) and (url.startswith("/") or url.startswith("http://") or url.startswith("https://")):
            return url
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)
        return url


class PublicProfileSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    achievements = serializers.SerializerMethodField()
    published_posts = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            "user_id",
            "nickname",
            "display_name",
            "bio",
            "level",
            "avatar_url",
            "tags",
            "achievements",
            "published_posts",
        )

    def get_display_name(self, obj: UserProfile) -> str:
        return obj.nickname or f"user{obj.user_id}"

    def get_avatar_url(self, obj: UserProfile) -> str | None:
        if not obj.avatar:
            return None
        return obj.avatar.url

    def get_tags(self, obj: UserProfile) -> list[dict]:
        qs = Tag.objects.filter(user_links__user_id=obj.user_id).order_by("category", "name")
        return TagSerializer(qs, many=True).data

    def get_achievements(self, obj: UserProfile) -> list[dict]:
        qs = UserAchievement.objects.filter(user_id=obj.user_id).select_related("achievement")
        return [
            {"id": ua.achievement_id, "title": ua.achievement.title, "received_at": ua.received_at}
            for ua in qs
        ]

    def get_published_posts(self, obj: UserProfile) -> list[dict]:
        posts = self.context.get("published_posts")
        if not posts:
            return []
        return PostFeedSerializer(posts, many=True, context=self.context).data


class OnboardingSubmitSerializer(serializers.Serializer):
    q1_experience = serializers.CharField()
    q2_frequency = serializers.CharField()
    q3_status = serializers.CharField()
    q4_directions = serializers.ListField(child=serializers.CharField(), allow_empty=False, max_length=10)
    q5_difficulties = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True, max_length=3)

    def validate(self, attrs):
        allowed_q1 = {"опытный", "без опыта", "начинающий"}
        allowed_q2 = {"очень редко", "иногда", "регулярно", "ежедневно", "редко"}
        allowed_q3 = {"академическое обучение", "самоучка", "профессионал"}

        q1 = attrs["q1_experience"]
        q2 = attrs["q2_frequency"]
        q3 = attrs["q3_status"]
        if q1 not in allowed_q1:
            raise serializers.ValidationError({"q1_experience": "Недопустимое значение"})
        if q2 not in allowed_q2:
            raise serializers.ValidationError({"q2_frequency": "Недопустимое значение"})
        if q3 not in allowed_q3:
            raise serializers.ValidationError({"q3_status": "Недопустимое значение"})

        # De-duplicate lists while keeping order.
        def uniq(seq: list[str]) -> list[str]:
            out: list[str] = []
            seen: set[str] = set()
            for x in seq:
                if x not in seen:
                    seen.add(x)
                    out.append(x)
            return out

        attrs["q4_directions"] = uniq(attrs["q4_directions"])
        attrs["q5_difficulties"] = uniq(attrs.get("q5_difficulties") or [])

        if len(attrs["q4_directions"]) > 10:
            raise serializers.ValidationError({"q4_directions": "Можно выбрать максимум 10"})
        if len(attrs["q5_difficulties"]) > 3:
            raise serializers.ValidationError({"q5_difficulties": "Можно выбрать максимум 3"})

        return attrs
