"""API активности: фиксация визита за день и выдача серии / дат для календаря."""

from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_app.activity_utils import compute_streak_days
from platform_app.models import DailyActivity


def _activity_payload(user) -> dict:
    dates = list(DailyActivity.objects.filter(user=user).values_list("date", flat=True))
    ds = set(dates)
    streak = compute_streak_days(ds)
    sorted_iso = sorted(d.isoformat() for d in ds)
    return {"streak": streak, "active_dates": sorted_iso}


class ActivityPingView(APIView):
    """POST: зафиксировать визит за сегодня (по локальной дате сервера) и вернуть серию + даты."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        today = timezone.localdate()
        DailyActivity.objects.get_or_create(user=request.user, date=today)
        return Response(_activity_payload(request.user))


class ActivitySummaryView(APIView):
    """GET: серия и все дни с активностью (без записи нового визита)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_activity_payload(request.user))
