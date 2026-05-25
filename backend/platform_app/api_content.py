import json

from django.db import transaction
from django.db.models import Count, DateTimeField
from django.db.models import F
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_app.models import (
    AiGeneration,
    Bookmark,
    ChallengeDay,
    Comment,
    Like,
    Material,
    Media,
    Palette,
    Post,
    PostMedia,
    PostTag,
    Tag,
    User,
    UserProfile,
)
from platform_app.permissions import IsAdmin, OnboardingCompletedForUnsafe, user_is_admin
from platform_app.serializers import (
    AiGenerationSerializer,
    CommentSerializer,
    MaterialCreateSerializer,
    MaterialSerializer,
    PaletteSerializer,
    PostFeedSerializer,
    PublicProfileSerializer,
    TagSerializer,
)

POST_ENTITY = "post"
ENTITY_AI_GEN = "ai_generation"
ENTITY_PALETTE = "palette"
ENTITY_MATERIAL = "material"


def _delete_post_and_files(post: Post) -> None:
    """Удалить пост и связанные данные; файлы изображений с диска; осиротевшие Media — тоже."""
    from platform_app.challenge_services import on_challenge_post_deleted

    on_challenge_post_deleted(post)
    pk = post.pk
    media_ids = list(PostMedia.objects.filter(post_id=pk).values_list("media_id", flat=True).distinct())
    Like.objects.filter(entity_type=POST_ENTITY, entity_id=pk).delete()
    Bookmark.objects.filter(entity_type=POST_ENTITY, entity_id=pk).delete()
    post.delete()
    for mid in media_ids:
        if PostMedia.objects.filter(media_id=mid).exists():
            continue
        media_obj = Media.objects.filter(pk=mid).first()
        if not media_obj:
            continue
        if media_obj.image:
            media_obj.image.delete(save=False)
        media_obj.delete()


def _posts_order_by_publication(qs):
    """Свежие публикации сверху: по моменту выхода в ленту (published_at), иначе по подаче."""
    # Avoid annotate(Coalesce) for better planner/index friendliness.
    # For published posts, published_at is usually set; for safety fall back to created_at.
    return qs.order_by(
        F("published_at").desc(nulls_last=True),
        F("created_at").desc(),
    )


def _decorate_posts_for_feed(posts: list[Post], user: User | None) -> None:
    ids = [p.id for p in posts]
    if not ids:
        return
    like_rows = (
        Like.objects.filter(entity_type=POST_ENTITY, entity_id__in=ids)
        .values("entity_id")
        .annotate(c=Count("id"))
    )
    like_counts = {r["entity_id"]: r["c"] for r in like_rows}
    comment_rows = Comment.objects.filter(post_id__in=ids).values("post_id").annotate(c=Count("id"))
    comment_counts = {r["post_id"]: r["c"] for r in comment_rows}
    liked_ids: set[int] = set()
    bookmarked_ids: set[int] = set()
    if user and user.is_authenticated:
        liked_ids = set(
            Like.objects.filter(
                user=user,
                entity_type=POST_ENTITY,
                entity_id__in=ids,
            ).values_list("entity_id", flat=True)
        )
        bookmarked_ids = set(
            Bookmark.objects.filter(
                user=user,
                entity_type=POST_ENTITY,
                entity_id__in=ids,
            ).values_list("entity_id", flat=True)
        )
    for p in posts:
        p.likes_count = like_counts.get(p.id, 0)
        p.comments_count = comment_counts.get(p.id, 0)
        p.liked_by_me = p.id in liked_ids
        p.bookmarked_by_me = p.id in bookmarked_ids


class TagCatalogView(generics.ListAPIView):
    """Все теги платформы (для выбора при публикации и материалах)."""

    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Tag.objects.all().order_by("category", "name")


class PostFeedView(generics.ListAPIView):
    serializer_class = PostFeedSerializer
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def get_queryset(self):
        return _posts_order_by_publication(
            Post.objects.filter(status="published")
            .select_related("author")
            .prefetch_related("post_tags__tag", "post_media_links__media"),
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        posts = list(page) if page is not None else list(queryset)
        _decorate_posts_for_feed(posts, request.user)
        serializer = self.get_serializer(posts, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class PostMyListView(generics.ListAPIView):
    serializer_class = PostFeedSerializer
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def get_queryset(self):
        return _posts_order_by_publication(
            Post.objects.filter(author=self.request.user)
            .select_related("author")
            .prefetch_related("post_tags__tag", "post_media_links__media"),
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        posts = list(queryset)
        _decorate_posts_for_feed(posts, request.user)
        serializer = self.get_serializer(posts, many=True)
        return Response(serializer.data)


class PostSubmissionCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def post(self, request):
        raw_cd = request.data.get("challenge_day_id")
        if raw_cd not in (None, ""):
            try:
                challenge_day_id = int(raw_cd)
            except (TypeError, ValueError):
                return Response({"detail": "Некорректный challenge_day_id"}, status=status.HTTP_400_BAD_REQUEST)
            return self._submit_challenge_slot(request, challenge_day_id)

        title = (request.data.get("title") or "").strip()
        description = (request.data.get("description") or "").strip()
        raw_tags = request.data.get("tag_ids", "[]")
        try:
            if isinstance(raw_tags, str):
                tag_ids = json.loads(raw_tags)
            else:
                tag_ids = raw_tags
        except json.JSONDecodeError:
            return Response({"detail": "tag_ids должен быть JSON-массивом id"}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(tag_ids, list):
            return Response({"detail": "tag_ids должен быть массивом"}, status=status.HTTP_400_BAD_REQUEST)
        tag_ids = [int(x) for x in tag_ids]
        if len(tag_ids) < 1 or len(tag_ids) > 5:
            return Response({"detail": "Укажите от 1 до 5 тегов"}, status=status.HTTP_400_BAD_REQUEST)
        if len(tag_ids) != len(set(tag_ids)):
            return Response({"detail": "Теги не должны повторяться"}, status=status.HTTP_400_BAD_REQUEST)
        tags = list(Tag.objects.filter(id__in=tag_ids))
        if len(tags) != len(tag_ids):
            return Response({"detail": "Указаны неизвестные теги"}, status=status.HTTP_400_BAD_REQUEST)
        if not title:
            return Response({"detail": "Укажите название работы"}, status=status.HTTP_400_BAD_REQUEST)

        files = request.FILES.getlist("images")
        if len(files) < 1 or len(files) > 3:
            return Response({"detail": "Загрузите от 1 до 3 изображений"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            post = Post.objects.create(
                author=request.user,
                title=title[:255],
                description=description,
                status="pending",
            )
            PostTag.objects.bulk_create([PostTag(post=post, tag=t) for t in tags], ignore_conflicts=True)
            for order, f in enumerate(files):
                media = Media.objects.create(owner=request.user, type="image", image=f)
                PostMedia.objects.create(post=post, media=media, order=order)

        post = (
            Post.objects.filter(pk=post.pk)
            .select_related("author")
            .prefetch_related("post_tags__tag", "post_media_links__media")
            .first()
        )
        _decorate_posts_for_feed([post], request.user)
        return Response(PostFeedSerializer(post, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def _submit_challenge_slot(self, request, challenge_day_id: int):
        from platform_app.challenge_services import challenge_tag_name

        title = (request.data.get("title") or "").strip()
        description = (request.data.get("description") or "").strip()
        if not title:
            return Response({"detail": "Укажите название работы"}, status=status.HTTP_400_BAD_REQUEST)
        files = request.FILES.getlist("images")
        if len(files) < 1 or len(files) > 3:
            return Response({"detail": "Загрузите от 1 до 3 изображений"}, status=status.HTTP_400_BAD_REQUEST)

        day = (
            ChallengeDay.objects.select_related("participation__user", "participation__challenge")
            .filter(pk=challenge_day_id)
            .first()
        )
        if not day:
            return Response({"detail": "Ячейка испытания не найдена"}, status=status.HTTP_404_NOT_FOUND)
        part = day.participation
        if part.user_id != request.user.id:
            return Response({"detail": "Нет доступа к этой ячейке"}, status=status.HTTP_403_FORBIDDEN)
        ch = part.challenge
        if not ch.is_published:
            return Response({"detail": "Испытание недоступно"}, status=status.HTTP_400_BAD_REQUEST)
        if part.completed_at:
            return Response({"detail": "Испытание уже завершено"}, status=status.HTTP_400_BAD_REQUEST)
        if day.post_id:
            st_existing = Post.objects.filter(pk=day.post_id).values_list("status", flat=True).first()
            if st_existing == "pending":
                return Response(
                    {"detail": "По этой ячейке уже отправлена работа на модерацию"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if st_existing == "published":
                return Response({"detail": "Ячейка уже закрыта"}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.now().date()
        if day.slot_date and day.slot_date != today:
            return Response(
                {
                    "detail": "Работу по этой ячейке нужно отправить в день "
                    f"{day.slot_date.strftime('%d.%m.%Y')} (сегодня {today.strftime('%d.%m.%Y')}).",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        tag_name = challenge_tag_name(ch)[:64]
        if not tag_name.strip():
            return Response({"detail": "У испытания задано некорректное название для тега"}, status=status.HTTP_400_BAD_REQUEST)

        raw_tags = request.data.get("tag_ids", "[]")
        try:
            if isinstance(raw_tags, str):
                tag_ids = json.loads(raw_tags)
            else:
                tag_ids = raw_tags
        except json.JSONDecodeError:
            return Response({"detail": "tag_ids должен быть JSON-массивом id"}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(tag_ids, list):
            return Response({"detail": "tag_ids должен быть массивом"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            tag_ids = [int(x) for x in tag_ids]
        except (TypeError, ValueError):
            return Response({"detail": "tag_ids: только целые id"}, status=status.HTTP_400_BAD_REQUEST)
        if len(tag_ids) < 1 or len(tag_ids) > 5:
            return Response({"detail": "Укажите от 1 до 5 тегов"}, status=status.HTTP_400_BAD_REQUEST)
        if len(tag_ids) != len(set(tag_ids)):
            return Response({"detail": "Теги не должны повторяться"}, status=status.HTTP_400_BAD_REQUEST)
        tags_user = list(Tag.objects.filter(id__in=tag_ids))
        if len(tags_user) != len(tag_ids):
            return Response({"detail": "Указаны неизвестные теги"}, status=status.HTTP_400_BAD_REQUEST)

        challenge_tag, _ = Tag.objects.get_or_create(
            name=tag_name,
            defaults={"category": "челлендж"},
        )
        merged_ids: list[int] = []
        seen: set[int] = set()
        if challenge_tag.id not in tag_ids:
            merged_ids.append(challenge_tag.id)
            seen.add(challenge_tag.id)
        for tid in tag_ids:
            if tid in seen:
                continue
            if len(merged_ids) >= 5:
                break
            merged_ids.append(tid)
            seen.add(tid)
        tags_ordered = []
        tag_by_id = {t.id: t for t in Tag.objects.filter(id__in=merged_ids)}
        for tid in merged_ids:
            t = tag_by_id.get(tid)
            if t:
                tags_ordered.append(t)

        with transaction.atomic():
            post = Post.objects.create(
                author=request.user,
                title=title[:255],
                description=description,
                status="pending",
            )
            PostTag.objects.bulk_create([PostTag(post=post, tag=t) for t in tags_ordered], ignore_conflicts=True)
            for order, f in enumerate(files):
                media = Media.objects.create(owner=request.user, type="image", image=f)
                PostMedia.objects.create(post=post, media=media, order=order)
            day.post = post
            day.save(update_fields=["post"])

        post = (
            Post.objects.filter(pk=post.pk)
            .select_related("author")
            .prefetch_related("post_tags__tag", "post_media_links__media")
            .first()
        )
        _decorate_posts_for_feed([post], request.user)
        return Response(PostFeedSerializer(post, context={"request": request}).data, status=status.HTTP_201_CREATED)


class PostPendingModerationView(generics.ListAPIView):
    serializer_class = PostFeedSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get_queryset(self):
        return (
            Post.objects.filter(status="pending")
            .select_related("author")
            .prefetch_related("post_tags__tag", "post_media_links__media")
            .order_by("created_at")
        )

    def list(self, request, *args, **kwargs):
        posts = list(self.get_queryset())
        _decorate_posts_for_feed(posts, request.user)
        return Response(self.get_serializer(posts, many=True).data)


class PostModerateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk: int):
        action = (request.data.get("action") or "").strip().lower()
        reason = (request.data.get("reason") or "").strip()
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response({"detail": "Публикация не найдена"}, status=status.HTTP_404_NOT_FOUND)
        if post.status != "pending":
            return Response({"detail": "Заявка уже обработана"}, status=status.HTTP_400_BAD_REQUEST)
        from platform_app.challenge_services import on_challenge_post_published, on_challenge_post_rejected_or_freed

        if action == "approve":
            post.status = "published"
            post.rejection_reason = ""
            post.published_at = timezone.now()
            post.save(update_fields=["status", "rejection_reason", "published_at"])
            on_challenge_post_published(post)
        elif action == "reject":
            if not reason:
                return Response({"detail": "Укажите причину отклонения"}, status=status.HTTP_400_BAD_REQUEST)
            post.status = "rejected"
            post.rejection_reason = reason[:2000]
            post.save(update_fields=["status", "rejection_reason"])
            on_challenge_post_rejected_or_freed(post.pk)
        else:
            return Response({"detail": "action: approve или reject"}, status=status.HTTP_400_BAD_REQUEST)
        post = (
            Post.objects.filter(pk=post.pk)
            .select_related("author")
            .prefetch_related("post_tags__tag", "post_media_links__media")
            .first()
        )
        _decorate_posts_for_feed([post], request.user)
        return Response(PostFeedSerializer(post, context={"request": request}).data)


class PostLikeToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def post(self, request, pk: int):
        try:
            post = Post.objects.get(pk=pk, status="published")
        except Post.DoesNotExist:
            return Response({"detail": "Публикация не найдена"}, status=status.HTTP_404_NOT_FOUND)
        like, created = Like.objects.get_or_create(
            user=request.user,
            entity_type=POST_ENTITY,
            entity_id=post.id,
        )
        liked = True
        if not created:
            like.delete()
            liked = False
        likes_count = Like.objects.filter(entity_type=POST_ENTITY, entity_id=post.id).count()
        return Response({"liked": liked, "likes_count": likes_count})


class PostBookmarkToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def post(self, request, pk: int):
        try:
            post = Post.objects.get(pk=pk, status="published")
        except Post.DoesNotExist:
            return Response({"detail": "Публикация не найдена"}, status=status.HTTP_404_NOT_FOUND)
        bm, created = Bookmark.objects.get_or_create(
            user=request.user,
            entity_type=POST_ENTITY,
            entity_id=post.id,
        )
        saved = True
        if not created:
            bm.delete()
            saved = False
        return Response({"saved": saved})


class PostCommentsView(APIView):
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def get(self, request, pk: int):
        try:
            post = Post.objects.get(pk=pk, status="published")
        except Post.DoesNotExist:
            return Response({"detail": "Публикация не найдена"}, status=status.HTTP_404_NOT_FOUND)
        qs = Comment.objects.filter(post=post).select_related("author").order_by("created_at")
        return Response(CommentSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request, pk: int):
        try:
            post = Post.objects.get(pk=pk, status="published")
        except Post.DoesNotExist:
            return Response({"detail": "Публикация не найдена"}, status=status.HTTP_404_NOT_FOUND)
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"detail": "Введите текст комментария"}, status=status.HTTP_400_BAD_REQUEST)
        c = Comment.objects.create(author=request.user, post=post, text=text[:8000])
        c = Comment.objects.filter(pk=c.pk).select_related("author").first()
        return Response(CommentSerializer(c, context={"request": request}).data, status=status.HTTP_201_CREATED)


class PublicUserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def get(self, request, user_id: int):
        try:
            profile = UserProfile.objects.select_related("user").get(user_id=user_id)
        except UserProfile.DoesNotExist:
            return Response({"detail": "Профиль не найден"}, status=status.HTTP_404_NOT_FOUND)
        posts = list(
            _posts_order_by_publication(
                Post.objects.filter(author_id=user_id, status="published")
                .select_related("author")
                .prefetch_related("post_tags__tag", "post_media_links__media"),
            )[:24],
        )
        _decorate_posts_for_feed(posts, request.user)
        ser = PublicProfileSerializer(
            profile,
            context={"request": request, "published_posts": posts},
        )
        return Response(ser.data)


class MaterialListView(generics.ListAPIView):
    serializer_class = MaterialSerializer
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]
    pagination_class = None

    def get_queryset(self):
        qs = Material.objects.select_related("author").prefetch_related("material_tags__tag").order_by("-created_at")
        mt = self.request.query_params.get("type")
        if mt:
            qs = qs.filter(type=mt.strip())
        tag_id = self.request.query_params.get("tag")
        if tag_id and tag_id.isdigit():
            qs = qs.filter(material_tags__tag_id=int(tag_id)).distinct()
        if self.request.query_params.get("for_me") == "1" and not user_is_admin(self.request.user):
            user_tag_ids = Tag.objects.filter(user_links__user=self.request.user).values_list("id", flat=True)
            qs = qs.filter(material_tags__tag_id__in=user_tag_ids).distinct()
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        materials = list(queryset)
        bookmarked_ids: set[int] = set()
        if request.user.is_authenticated and materials:
            mids = [m.id for m in materials]
            bookmarked_ids = set(
                Bookmark.objects.filter(
                    user=request.user,
                    entity_type=ENTITY_MATERIAL,
                    entity_id__in=mids,
                ).values_list("entity_id", flat=True)
            )
        for m in materials:
            m._bookmarked = m.id in bookmarked_ids
        serializer = self.get_serializer(materials, many=True)
        return Response(serializer.data)


class MaterialCreateAdminView(generics.CreateAPIView):
    serializer_class = MaterialCreateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        instance = (
            Material.objects.filter(pk=serializer.instance.pk)
            .select_related("author")
            .prefetch_related("material_tags__tag")
            .first()
        )
        return Response(
            MaterialSerializer(instance, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class SavedPostsView(generics.ListAPIView):
    """Публикации из закладок текущего пользователя."""

    serializer_class = PostFeedSerializer
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def get_queryset(self):
        ids = Bookmark.objects.filter(user=self.request.user, entity_type=POST_ENTITY).values_list(
            "entity_id", flat=True
        )
        return _posts_order_by_publication(
            Post.objects.filter(id__in=ids, status="published")
            .select_related("author")
            .prefetch_related("post_tags__tag", "post_media_links__media"),
        )

    def list(self, request, *args, **kwargs):
        posts = list(self.get_queryset())
        _decorate_posts_for_feed(posts, request.user)
        return Response(self.get_serializer(posts, many=True).data)


class PostDetailPublicView(APIView):
    """GET: одна опубликованная работа. DELETE: автор или админ — полное удаление записи и файлов."""

    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def get(self, request, pk: int):
        post = (
            Post.objects.filter(pk=pk, status="published")
            .select_related("author")
            .prefetch_related("post_tags__tag", "post_media_links__media")
            .first()
        )
        if not post:
            return Response({"detail": "Публикация не найдена"}, status=status.HTTP_404_NOT_FOUND)
        _decorate_posts_for_feed([post], request.user)
        return Response(PostFeedSerializer(post, context={"request": request}).data)

    def delete(self, request, pk: int):
        try:
            post = Post.objects.get(pk=pk)
        except Post.DoesNotExist:
            return Response({"detail": "Публикация не найдена"}, status=status.HTTP_404_NOT_FOUND)
        if post.author_id != request.user.id and not user_is_admin(request.user):
            return Response({"detail": "Нет прав на удаление"}, status=status.HTTP_403_FORBIDDEN)
        _delete_post_and_files(post)
        return Response(status=status.HTTP_204_NO_CONTENT)


class BookmarksOverviewView(APIView):
    """Все закладки: работы, генерации, палитры (порядок — от новых к старым)."""

    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def get(self, request):
        marks = list(Bookmark.objects.filter(user=request.user).order_by("-id"))
        post_ids: list[int] = []
        gen_ids: list[int] = []
        pal_ids: list[int] = []
        mat_ids: list[int] = []
        for m in marks:
            if m.entity_type == POST_ENTITY:
                post_ids.append(m.entity_id)
            elif m.entity_type == ENTITY_AI_GEN:
                gen_ids.append(m.entity_id)
            elif m.entity_type == ENTITY_PALETTE:
                pal_ids.append(m.entity_id)
            elif m.entity_type == ENTITY_MATERIAL:
                mat_ids.append(m.entity_id)

        posts_qs = _posts_order_by_publication(
            Post.objects.filter(id__in=post_ids, status="published")
            .select_related("author")
            .prefetch_related("post_tags__tag", "post_media_links__media"),
        )
        posts_by_id = {p.id: p for p in posts_qs}
        posts = [posts_by_id[i] for i in post_ids if i in posts_by_id]
        posts.sort(key=lambda p: (p.published_at or p.created_at), reverse=True)
        _decorate_posts_for_feed(posts, request.user)

        gens_qs = AiGeneration.objects.filter(id__in=gen_ids).order_by()
        gens_by_id = {g.id: g for g in gens_qs}
        generations = [gens_by_id[i] for i in gen_ids if i in gens_by_id]

        pals_qs = Palette.objects.filter(id__in=pal_ids).prefetch_related("colors")
        pals_by_id = {p.id: p for p in pals_qs}
        palettes = [pals_by_id[i] for i in pal_ids if i in pals_by_id]

        mats_qs = (
            Material.objects.filter(id__in=mat_ids)
            .select_related("author")
            .prefetch_related("material_tags__tag")
        )
        mats_by_id = {x.id: x for x in mats_qs}
        materials_list = [mats_by_id[i] for i in mat_ids if i in mats_by_id]
        for m in materials_list:
            m._bookmarked = True
        materials_data = MaterialSerializer(materials_list, many=True, context={"request": request}).data

        return Response(
            {
                "posts": PostFeedSerializer(posts, many=True, context={"request": request}).data,
                "materials": materials_data,
                "generations": AiGenerationSerializer(generations, many=True).data,
                "palettes": PaletteSerializer(palettes, many=True).data,
            }
        )


class MaterialDestroyView(APIView):
    """DELETE: полное удаление материала (только админ)."""

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def delete(self, request, pk: int):
        try:
            mat = Material.objects.get(pk=pk)
        except Material.DoesNotExist:
            return Response({"detail": "Материал не найден"}, status=status.HTTP_404_NOT_FOUND)
        Bookmark.objects.filter(entity_type=ENTITY_MATERIAL, entity_id=pk).delete()
        mat.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MaterialBookmarkToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def post(self, request, pk: int):
        try:
            mat = Material.objects.get(pk=pk)
        except Material.DoesNotExist:
            return Response({"detail": "Материал не найден"}, status=status.HTTP_404_NOT_FOUND)
        bm, created = Bookmark.objects.get_or_create(
            user=request.user,
            entity_type=ENTITY_MATERIAL,
            entity_id=mat.id,
        )
        saved = True
        if not created:
            bm.delete()
            saved = False
        return Response({"saved": saved})


class AiGenerationBookmarkToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def post(self, request, pk: int):
        try:
            gen = AiGeneration.objects.get(pk=pk)
        except AiGeneration.DoesNotExist:
            return Response({"detail": "Генерация не найдена"}, status=status.HTTP_404_NOT_FOUND)
        if gen.user_id != request.user.id:
            return Response({"detail": "Нет доступа к этой генерации"}, status=status.HTTP_403_FORBIDDEN)
        bm, created = Bookmark.objects.get_or_create(
            user=request.user,
            entity_type=ENTITY_AI_GEN,
            entity_id=gen.id,
        )
        saved = True
        if not created:
            bm.delete()
            saved = False
        return Response({"saved": saved})


class PaletteBookmarkToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def post(self, request, pk: int):
        try:
            pal = Palette.objects.get(pk=pk)
        except Palette.DoesNotExist:
            return Response({"detail": "Палитра не найдена"}, status=status.HTTP_404_NOT_FOUND)
        if pal.user_id != request.user.id:
            return Response({"detail": "Нет доступа к этой палитре"}, status=status.HTTP_403_FORBIDDEN)
        bm, created = Bookmark.objects.get_or_create(
            user=request.user,
            entity_type=ENTITY_PALETTE,
            entity_id=pal.id,
        )
        saved = True
        if not created:
            bm.delete()
            saved = False
        return Response({"saved": saved})
