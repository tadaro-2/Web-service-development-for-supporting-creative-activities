"""Расчёт текущей серии дней активности (подряд визитов по календарным дням)."""

from __future__ import annotations

from datetime import date, timedelta

from django.utils import timezone


def compute_streak_days(active_dates: set[date]) -> int:
    """
    Текущая серия: подряд идущие дни с активностью, заканчивающиеся сегодня
    (если сегодня уже отмечено) или вчера (если сегодня ещё не заходили, но вчера была серия).
    Если разрыв больше суток — серия 0.
    """
    if not active_dates:
        return 0
    today = timezone.localdate()
    if today in active_dates:
        anchor: date = today
    elif (today - timedelta(days=1)) in active_dates:
        anchor = today - timedelta(days=1)
    else:
        return 0
    n = 0
    d = anchor
    while d in active_dates:
        n += 1
        d -= timedelta(days=1)
    return n
