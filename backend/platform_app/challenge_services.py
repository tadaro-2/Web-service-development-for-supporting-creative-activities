"""Логика слотов челленджа, завершения и наград."""

from __future__ import annotations

from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone

from platform_app.models import (
    Achievement,
    Challenge,
    ChallengeDay,
    ChallengeParticipation,
    Post,
    UserAchievement,
)


def unpublish_expired_challenges_by_end_date() -> int:
    """
    Автоснятие с сайта: у испытания задана date_end — показываем до конца этого дня
    и ещё один календарный день после; на следующий день снимаем с публикации.

    Условие снятия: сегодняшняя дата > date_end + 1 день ⇔ date_end < сегодня − 1 день.
    Без date_end правило не применяется.
    """
    today = timezone.now().date()
    threshold = today - timedelta(days=1)
    return Challenge.objects.filter(
        is_published=True,
        date_end__isnull=False,
        date_end__lt=threshold,
    ).update(is_published=False)


def challenge_slot_count(ch: Challenge) -> int:
    """Сколько ячеек в испытании (после публикации настроек)."""
    if ch.date_start and ch.date_end and ch.date_start <= ch.date_end:
        d0 = ch.date_start
        n = 0
        while d0 <= ch.date_end:
            n += 1
            d0 = d0 + timedelta(days=1)
        return n
    if ch.required_publications and ch.required_publications >= 1:
        return int(ch.required_publications)
    if ch.duration_days and ch.duration_days >= 1:
        return int(ch.duration_days)
    return 0


def validate_challenge_publishable(ch: Challenge) -> str | None:
    """Вернуть текст ошибки или None."""
    if not (ch.title or "").strip():
        return "Укажите название испытания"
    if not (ch.description or "").strip():
        return "Укажите описание испытания"
    if not ch.cover:
        return "Загрузите заголовочную картинку"
    if not (ch.reward_title or "").strip():
        return "Укажите название достижения за прохождение"
    n = challenge_slot_count(ch)
    if n < 1:
        return "Задайте либо период (дата начала и окончания), либо число публикаций, либо количество дней"
    if ch.date_start and ch.date_end and ch.date_start > ch.date_end:
        return "Дата начала не может быть позже даты окончания"
    return None


def ensure_challenge_achievement(ch: Challenge) -> Achievement:
    """Создать или найти Achievement по reward_title."""
    title = (ch.reward_title or "").strip()[:255]
    ach, _ = Achievement.objects.get_or_create(
        title=title,
        defaults={"description": (ch.description or "")[:2000]},
    )
    ch.achievement = ach
    ch.save(update_fields=["achievement", "updated_at"])
    return ach


@transaction.atomic
def create_participation_slots(part: ChallengeParticipation) -> None:
    ch = Challenge.objects.select_for_update().get(pk=part.challenge_id)
    if ChallengeDay.objects.filter(participation=part).exists():
        return
    if ch.date_start and ch.date_end and ch.date_start <= ch.date_end:
        d0 = ch.date_start
        i = 0
        while d0 <= ch.date_end:
            ChallengeDay.objects.create(
                participation=part,
                day_number=i,
                slot_date=d0,
            )
            i += 1
            d0 = d0 + timedelta(days=1)
        return
    count = 0
    if ch.required_publications and ch.required_publications >= 1:
        count = int(ch.required_publications)
    elif ch.duration_days and ch.duration_days >= 1:
        count = int(ch.duration_days)
    for i in range(count):
        ChallengeDay.objects.create(
            participation=part,
            day_number=i,
            slot_date=None,
        )


def challenge_tag_name(ch: Challenge) -> str:
    """Имя тега = название челленджа (обрезка под поле Tag)."""
    return (ch.title or "").strip()[:64] or "challenge"


def slot_ui_status(day: ChallengeDay, *, today: date) -> str:
    """empty | pending | completed | missed"""
    if day.completed_at:
        return "completed"
    if post_id := day.post_id:
        st = Post.objects.filter(pk=post_id).values_list("status", flat=True).first()
        if st == "pending":
            return "pending"
        if st == "published":
            return "completed"
        # rejected / другой — слот снова доступен
    if day.slot_date and day.slot_date < today:
        return "missed"
    return "empty"


@transaction.atomic
def on_challenge_post_published(post: Post) -> None:
    """Вызывается после перевода поста в published."""
    day = (
        ChallengeDay.objects.select_related("participation__challenge")
        .filter(post_id=post.pk)
        .first()
    )
    if not day:
        return
    part = day.participation
    if part.completed_at:
        return
    ch = day.participation.challenge
    if post.status != "published":
        return

    day.completed_at = timezone.now()
    day.save(update_fields=["completed_at"])

    qs = ChallengeDay.objects.filter(participation=part)
    total = qs.count()
    done = qs.filter(completed_at__isnull=False).count()
    if total > 0 and done >= total:
        part.completed_at = timezone.now()
        part.save(update_fields=["completed_at"])
        if ch.achievement_id:
            UserAchievement.objects.get_or_create(
                user_id=part.user_id,
                achievement_id=ch.achievement_id,
            )


@transaction.atomic
def on_challenge_post_rejected_or_freed(post_id: int) -> None:
    """Отклонение модератором — отвязать пост от ячейки (можно подать снова)."""
    ChallengeDay.objects.filter(post_id=post_id).update(post=None, completed_at=None)


@transaction.atomic
def on_challenge_post_deleted(post: Post) -> None:
    """Удаление поста автором/админом: сбросить ячейку и при необходимости отозвать награду."""
    days = list(ChallengeDay.objects.filter(post_id=post.pk).select_related("participation__challenge"))
    if not days:
        return
    part_ids: set[int] = set()
    for day in days:
        part_ids.add(day.participation_id)
        day.post = None
        day.completed_at = None
        day.save(update_fields=["post", "completed_at"])
    for pid in part_ids:
        part = ChallengeParticipation.objects.select_related("challenge").get(pk=pid)
        total = ChallengeDay.objects.filter(participation=part).count()
        done = ChallengeDay.objects.filter(participation=part, completed_at__isnull=False).count()
        ch = part.challenge
        if done < total and part.completed_at:
            part.completed_at = None
            part.save(update_fields=["completed_at"])
            if ch.achievement_id:
                UserAchievement.objects.filter(
                    user_id=part.user_id,
                    achievement_id=ch.achievement_id,
                ).delete()


def participation_completed_reward_title(part: ChallengeParticipation) -> str | None:
    if not part.completed_at:
        return None
    ch = part.challenge
    if ch.achievement_id:
        return ch.achievement.title
    return (ch.reward_title or "").strip() or None
