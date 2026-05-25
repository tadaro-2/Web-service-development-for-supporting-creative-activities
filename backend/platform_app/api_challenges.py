"""API челленджей: админ — черновик/публикация; пользователи — список, детали, участие, прогресс."""

from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_app.challenge_services import (
    create_participation_slots,
    ensure_challenge_achievement,
    participation_completed_reward_title,
    slot_ui_status,
    unpublish_expired_challenges_by_end_date,
    validate_challenge_publishable,
)
from platform_app.models import Challenge, ChallengeDay, ChallengeParticipation, Post, User
from platform_app.permissions import IsAdmin, OnboardingCompletedForUnsafe, user_is_admin
from platform_app.serializers import ChallengeCardSerializer


def _participating_challenge_ids_for_user(user: User) -> set[int]:
    return set(
        ChallengeParticipation.objects.filter(user=user).values_list("challenge_id", flat=True),
    )


def _challenge_slots_payload(part: ChallengeParticipation, *, viewer: User) -> dict:
    today = timezone.now().date()
    rows = []
    for day in ChallengeDay.objects.filter(participation=part).order_by("day_number", "slot_date", "pk"):
        st = slot_ui_status(day, today=today)
        pid = None
        if day.post_id:
            ps = Post.objects.filter(pk=day.post_id).values_list("status", flat=True).first()
            if ps == "published" or (viewer.id == part.user_id and ps in ("pending", "rejected")):
                pid = day.post_id
        rows.append(
            {
                "id": day.id,
                "day_number": day.day_number,
                "slot_date": day.slot_date.isoformat() if day.slot_date else None,
                "status": st,
                "post_id": pid,
            }
        )
    reward_title = participation_completed_reward_title(part)
    return {
        "participation_id": part.id,
        "started_at": part.start_date.isoformat(),
        "completed_at": part.completed_at.isoformat() if part.completed_at else None,
        "reward_title": reward_title,
        "slots": rows,
    }


class ChallengeListPublicView(APIView):
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def get(self, request):
        unpublish_expired_challenges_by_end_date()
        qs = Challenge.objects.filter(is_published=True).order_by("-created_at")
        part_ids = _participating_challenge_ids_for_user(request.user)
        return Response(
            ChallengeCardSerializer(
                qs,
                many=True,
                context={"request": request, "participating_challenge_ids": part_ids},
            ).data,
        )


class ChallengeDetailPublicView(APIView):
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def get(self, request, pk: int):
        unpublish_expired_challenges_by_end_date()
        ch = Challenge.objects.filter(pk=pk).first()
        if not ch:
            return Response({"detail": "Испытание не найдено"}, status=status.HTTP_404_NOT_FOUND)
        if not ch.is_published and not user_is_admin(request.user):
            return Response({"detail": "Испытание не найдено"}, status=status.HTTP_404_NOT_FOUND)
        part_ids = _participating_challenge_ids_for_user(request.user)
        base = ChallengeCardSerializer(
            ch,
            context={"request": request, "participating_challenge_ids": part_ids},
        ).data
        part = (
            ChallengeParticipation.objects.filter(user=request.user, challenge=ch)
            .select_related("challenge", "challenge__achievement")
            .first()
        )
        extra: dict = {"participation": None}
        if part:
            extra["participation"] = _challenge_slots_payload(part, viewer=request.user)
        return Response({**base, **extra})


class ChallengeJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def post(self, request, pk: int):
        unpublish_expired_challenges_by_end_date()
        ch = Challenge.objects.filter(pk=pk, is_published=True).first()
        if not ch:
            return Response({"detail": "Испытание недоступно"}, status=status.HTTP_404_NOT_FOUND)
        if ChallengeParticipation.objects.filter(user=request.user, challenge=ch).exists():
            return Response({"detail": "Вы уже участвуете"}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            part = ChallengeParticipation.objects.create(
                user=request.user,
                challenge=ch,
                start_date=timezone.now().date(),
            )
            create_participation_slots(part)
        part = ChallengeParticipation.objects.select_related("challenge", "challenge__achievement").get(pk=part.pk)
        return Response(_challenge_slots_payload(part, viewer=request.user), status=status.HTTP_201_CREATED)


class ChallengeParticipationRefreshView(APIView):
    """GET участие + слоты (после перезагрузки страницы)."""

    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def get(self, request, pk: int):
        unpublish_expired_challenges_by_end_date()
        ch = Challenge.objects.filter(pk=pk).first()
        if not ch:
            return Response({"detail": "Испытание не найдено"}, status=status.HTTP_404_NOT_FOUND)
        if not ch.is_published and not user_is_admin(request.user):
            return Response({"detail": "Испытание не найдено"}, status=status.HTTP_404_NOT_FOUND)
        part = (
            ChallengeParticipation.objects.filter(user=request.user, challenge=ch)
            .select_related("challenge", "challenge__achievement")
            .first()
        )
        if not part:
            return Response({"detail": "Сначала примите участие"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_challenge_slots_payload(part, viewer=request.user))


# ——— Админ ———


class AdminChallengeListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = Challenge.objects.all().order_by("-created_at")
        return Response(ChallengeCardSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        title = (request.data.get("title") or "").strip()
        description = (request.data.get("description") or "").strip()
        reward_title = (request.data.get("reward_title") or "").strip()
        raw_pub = request.data.get("required_publications")
        raw_dur = request.data.get("duration_days")
        ds = (request.data.get("date_start") or "").strip()
        de = (request.data.get("date_end") or "").strip()

        def opt_pos_int(val) -> int | None:
            if val is None or val == "":
                return None
            try:
                x = int(val)
                return x if x >= 1 else None
            except (TypeError, ValueError):
                return None

        required_publications = opt_pos_int(raw_pub)
        duration_days = opt_pos_int(raw_dur)
        date_start = None
        date_end = None
        if ds:
            from datetime import datetime as dtmod

            try:
                date_start = dtmod.fromisoformat(ds).date()
            except ValueError:
                return Response({"detail": "Некорректная date_start"}, status=status.HTTP_400_BAD_REQUEST)
        if de:
            from datetime import datetime as dtmod

            try:
                date_end = dtmod.fromisoformat(de).date()
            except ValueError:
                return Response({"detail": "Некорректная date_end"}, status=status.HTTP_400_BAD_REQUEST)

        cover = request.FILES.get("cover")
        publish_now = str(request.data.get("publish_now") or "").lower() in ("1", "true", "yes")

        try:
            with transaction.atomic():
                ch = Challenge.objects.create(
                    title=title[:255] or "Черновик",
                    description=description,
                    reward_title=reward_title[:255],
                    required_publications=required_publications,
                    duration_days=duration_days,
                    date_start=date_start,
                    date_end=date_end,
                    is_published=False,
                    published_at=None,
                )
                if cover:
                    ch.cover = cover
                    ch.save(update_fields=["cover", "updated_at"])
                ch.refresh_from_db()
                if publish_now:
                    err = validate_challenge_publishable(ch)
                    if err:
                        raise DjangoValidationError(err)
                    ensure_challenge_achievement(ch)
                    ch.is_published = True
                    ch.published_at = timezone.now()
                    ch.save(
                        update_fields=["is_published", "published_at", "achievement", "updated_at"],
                    )
        except DjangoValidationError as exc:
            msgs = getattr(exc, "messages", None) or getattr(exc, "error_list", None)
            msg = msgs[0] if msgs else str(exc)
            return Response({"detail": str(msg)}, status=status.HTTP_400_BAD_REQUEST)

        ch.refresh_from_db()
        return Response(ChallengeCardSerializer(ch, context={"request": request}).data, status=status.HTTP_201_CREATED)


class AdminChallengeDetailPatchView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def patch(self, request, pk: int):
        ch = Challenge.objects.filter(pk=pk).first()
        if not ch:
            return Response({"detail": "Не найдено"}, status=status.HTTP_404_NOT_FOUND)
        title = request.data.get("title")
        description = request.data.get("description")
        reward_title = request.data.get("reward_title")
        if title is not None:
            ch.title = str(title).strip()[:255]
        if description is not None:
            ch.description = str(description).strip()
        if reward_title is not None:
            ch.reward_title = str(reward_title).strip()[:255]

        for key in ("required_publications", "duration_days"):
            if key in request.data:
                val = request.data.get(key)
                if val is None or val == "":
                    setattr(ch, key, None)
                else:
                    try:
                        x = int(val)
                        setattr(ch, key, x if x >= 1 else None)
                    except (TypeError, ValueError):
                        pass

        if "date_start" in request.data:
            ds = request.data.get("date_start")
            if not ds:
                ch.date_start = None
            else:
                from datetime import datetime as dtmod

                try:
                    ch.date_start = dtmod.fromisoformat(str(ds)).date()
                except ValueError:
                    return Response({"detail": "Некорректная date_start"}, status=status.HTTP_400_BAD_REQUEST)
        if "date_end" in request.data:
            de = request.data.get("date_end")
            if not de:
                ch.date_end = None
            else:
                from datetime import datetime as dtmod

                try:
                    ch.date_end = dtmod.fromisoformat(str(de)).date()
                except ValueError:
                    return Response({"detail": "Некорректная date_end"}, status=status.HTTP_400_BAD_REQUEST)

        cover = request.FILES.get("cover")
        if cover:
            ch.cover = cover

        ch.save()
        return Response(ChallengeCardSerializer(ch, context={"request": request}).data)


class AdminChallengePublishView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk: int):
        ch = Challenge.objects.filter(pk=pk).first()
        if not ch:
            return Response({"detail": "Не найдено"}, status=status.HTTP_404_NOT_FOUND)
        err = validate_challenge_publishable(ch)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            ensure_challenge_achievement(ch)
            ch.is_published = True
            ch.published_at = timezone.now()
            ch.save(update_fields=["is_published", "published_at", "achievement", "updated_at"])
        return Response(ChallengeCardSerializer(ch, context={"request": request}).data)


class AdminChallengeUnpublishView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk: int):
        ch = Challenge.objects.filter(pk=pk).first()
        if not ch:
            return Response({"detail": "Не найдено"}, status=status.HTTP_404_NOT_FOUND)
        ch.is_published = False
        ch.save(update_fields=["is_published", "updated_at"])
        return Response(ChallengeCardSerializer(ch, context={"request": request}).data)
