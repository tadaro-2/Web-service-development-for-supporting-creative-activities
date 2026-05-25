from datetime import timedelta
import threading

from django.db import transaction
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from platform_app.email_utils import generate_verification_code, send_verification_code_email
from platform_app.models import EmailVerification, Tag, User, UserProfile, UserTag
from platform_app.permissions import OnboardingCompletedForUnsafe
from platform_app.serializers import (
    OnboardingSubmitSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    TagSerializer,
    UserPublicSerializer,
    UserProfileMeSerializer,
    VerifyEmailSerializer,
)


def _tokens_for_user(user: User) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }

def _send_verification_email_async(*, to_email: str, code: str) -> None:
    def _run():
        try:
            send_verification_code_email(to_email=to_email, code=code)
        except Exception:
            # Email failures should not break the request flow (SMTP can be down/misconfigured).
            pass

    threading.Thread(target=_run, daemon=True).start()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        code = generate_verification_code()
        EmailVerification.objects.create(
            user=user,
            token=code,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        _send_verification_email_async(to_email=user.email, code=code)

        return Response(
            {
                "user": UserPublicSerializer(user).data,
                "message": "Код подтверждения отправлен на email",
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        code = serializer.validated_data["code"]

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"detail": "Пользователь не найден"}, status=status.HTTP_404_NOT_FOUND)

        ev = (
            EmailVerification.objects.filter(user=user, verified_at__isnull=True, token=code)
            .order_by("-sent_at")
            .first()
        )
        if not ev:
            return Response({"detail": "Неверный код"}, status=status.HTTP_400_BAD_REQUEST)

        if ev.expires_at and ev.expires_at < timezone.now():
            return Response({"detail": "Код истёк"}, status=status.HTTP_400_BAD_REQUEST)

        ev.verified_at = timezone.now()
        ev.save(update_fields=["verified_at"])

        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])

        return Response(
            {
                "user": UserPublicSerializer(user).data,
                "onboarding_required": not bool(getattr(getattr(user, "profile", None), "onboarding_completed", False)),
                **_tokens_for_user(user),
            }
        )


class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"detail": "Пользователь не найден"}, status=status.HTTP_404_NOT_FOUND)

        if user.email_verified:
            return Response({"detail": "Email уже подтверждён"}, status=status.HTTP_400_BAD_REQUEST)

        code = generate_verification_code()
        EmailVerification.objects.create(
            user=user,
            token=code,
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        _send_verification_email_async(to_email=user.email, code=code)
        return Response({"message": "Код отправлен повторно"})


class VerifiedOnlyTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not getattr(self.user, "email_verified", False):
            raise PermissionDenied("Подтвердите email, чтобы войти")
        profile = getattr(self.user, "profile", None)
        data["onboarding_required"] = not bool(getattr(profile, "onboarding_completed", False))
        return data


class VerifiedOnlyTokenObtainPairView(TokenObtainPairView):
    serializer_class = VerifiedOnlyTokenSerializer


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserPublicSerializer(request.user).data)


class MyTagsView(generics.ListAPIView):
    """
    Return current user's fixed tags (from user_tag -> tag).
    """

    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]
    # Global PageNumberPagination would wrap this in { count, results }; UI expects a plain list.
    pagination_class = None

    def get_queryset(self):
        return Tag.objects.filter(user_links__user=self.request.user).order_by("category", "name")


class MyProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response(UserProfileMeSerializer(profile, context={"request": request}).data)

    def patch(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileMeSerializer(
            profile,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CheckNicknameView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        nickname = (request.query_params.get("nickname") or "").strip()
        if not nickname:
            return Response({"available": False, "detail": "nickname is required"}, status=status.HTTP_400_BAD_REQUEST)
        # Reuse validation rules indirectly: only check if it's taken here.
        taken = UserProfile.objects.filter(nickname__iexact=nickname).exclude(user=request.user).exists()
        return Response({"available": not taken})


def _seed_onboarding_tags_if_needed() -> None:
    """
    Ensure the global tag list exists in DB.
    Safe to call multiple times (uses ignore_conflicts).
    """
    base = [
        # Q1
        ("опытный", "experience"),
        ("без опыта", "experience"),
        ("начинающий", "experience"),
        # Q2
        ("редко", "frequency"),
        ("ежедневно", "frequency"),
        ("регулярно", "frequency"),
        ("иногда", "frequency"),
        ("очень редко", "frequency"),
        # Q3
        ("академическое обучение", "status"),
        ("самоучка", "status"),
        ("профессионал", "status"),
        # Q5
        ("арт-блок", "difficulty"),
        ("выгорание", "difficulty"),
        ("прокрастинация", "difficulty"),
        ("нехватка времени", "difficulty"),
        ("неуверенность", "difficulty"),
        ("страх критики", "difficulty"),
        ("перфекционизм", "difficulty"),
        ("отсутствие идей", "difficulty"),
        ("отсутствие прогресса", "difficulty"),
        ("проблемы с анатомией", "difficulty"),
        ("проблемы с композицией", "difficulty"),
        ("проблемы с цветом", "difficulty"),
        ("отсутствие стиля", "difficulty"),
        ("трудности с персонажами", "difficulty"),
        ("трудности с фонами", "difficulty"),
        ("нехватка знаний", "difficulty"),
        ("финансовые трудности", "difficulty"),
        ("отсутствие заказов", "difficulty"),
        ("проблемы с продвижением", "difficulty"),
        ("страх публикации", "difficulty"),
    ]

    directions = [
        "реализм",
        "гиперреализм",
        "импрессионизм",
        "экспрессионизм",
        "сюрреализм",
        "кубизм",
        "абстракционизм",
        "минимализм",
        "символизм",
        "футуризм",
        "концептуализм",
        "поп-арт",
        "ар-деко",
        "барокко",
        "рококо",
        "ренессанс",
        "digital painting",
        "concept art",
        "matte painting",
        "pixel art",
        "low poly",
        "3D render",
        "stylized",
        "semi-realism",
        "anime",
        "manga",
        "webtoon",
        "cartoon",
        "comic style",
        "vector art",
        "flat design",
        "портрет",
        "автопортрет",
        "пейзаж",
        "натюрморт",
        "анималистика",
        "архитектура",
        "интерьеры",
        "фэнтези",
        "sci-fi",
        "историческая живопись",
        "иллюстрация",
        "комиксы",
        "fan-art",
        "line art",
        "sketch",
        "doodle",
        "flat illustration",
        "outline",
        "ink",
        "акварельный стиль",
        "масляная живопись",
        "графика",
        "гравюра",
        "chibi",
        "stylized proportions",
        "fan art",
        "AU",
        "OC",
        "aesthetic art",
        "dark art",
        "soft art",
        "edgy style",
        "dreamcore",
        "weirdcore",
        "liminal space",
        "vaporwave",
        "cyberpunk",
        "steampunk",
        "мрачный",
        "светлый",
        "меланхоличный",
        "драматичный",
        "уютный",
        "эпичный",
        "романтичный",
        "хоррор",
        "сюрреалистичный",
        "карандаш",
        "уголь",
        "чернила",
        "акварель",
        "гуашь",
        "масло",
        "маркеры",
        "цифровая живопись",
        "isometric",
        "pixel animation",
        "UI/UX illustration",
        "game art",
        "character design",
        "environment design",
        "splash art",
        "card art",
        "NFT-style",
        "sticker style",
    ]

    # De-duplicate names while preserving order.
    seen: set[str] = set()
    tag_objs: list[Tag] = []
    for name, category in base:
        if name not in seen:
            seen.add(name)
            tag_objs.append(Tag(name=name, category=category))
    for name in directions:
        if name not in seen:
            seen.add(name)
            tag_objs.append(Tag(name=name, category="direction"))

    Tag.objects.bulk_create(tag_objs, ignore_conflicts=True)


class OnboardingSurveyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        _seed_onboarding_tags_if_needed()

        directions = list(Tag.objects.filter(category="direction").order_by("name").values_list("name", flat=True))
        difficulties = list(Tag.objects.filter(category="difficulty").order_by("name").values_list("name", flat=True))

        return Response(
            {
                "completed": bool(getattr(getattr(request.user, "profile", None), "onboarding_completed", False)),
                "questions": [
                    {
                        "id": "q1_experience",
                        "text": "Как давно вы интересуетесь искусством?",
                        "type": "single",
                        "options": [
                            {"label": "Несколько лет", "tag": "опытный"},
                            {"label": "Не интересовался(ась)", "tag": "без опыта"},
                            {"label": "Не так давно", "tag": "начинающий"},
                        ],
                    },
                    {
                        "id": "q2_frequency",
                        "text": "Как часто вы рисуете?",
                        "type": "single",
                        "options": [
                            {"label": "10–15 минут в день", "tag": "редко"},
                            {"label": "Пару часов в день", "tag": "ежедневно"},
                            {"label": "Пару часов в неделю", "tag": "регулярно"},
                            {"label": "Пару часов в месяц", "tag": "иногда"},
                            {"label": "Раз в год, если звёзды подскажут", "tag": "очень редко"},
                        ],
                    },
                    {
                        "id": "q3_status",
                        "text": "Статус в этой сфере?",
                        "type": "single",
                        "options": [
                            {"label": "Учусь / учился(ась) в художественной школе", "tag": "академическое обучение"},
                            {"label": "Самостоятельное обучение / хобби", "tag": "самоучка"},
                            {"label": "Работаю в этой сфере", "tag": "профессионал"},
                        ],
                    },
                    {
                        "id": "q4_directions",
                        "text": "Какие из направлений вам ближе всего в данной сфере?",
                        "type": "multi",
                        "max": 10,
                        "options": [{"label": n, "tag": n} for n in directions],
                    },
                    {
                        "id": "q5_difficulties",
                        "text": "Какие трудности вы испытываете?",
                        "type": "multi",
                        "max": 3,
                        "options": [{"label": n, "tag": n} for n in difficulties],
                    },
                ],
            }
        )

    def post(self, request):
        _seed_onboarding_tags_if_needed()

        serializer = OnboardingSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            profile, _ = UserProfile.objects.select_for_update().get_or_create(user=request.user)
            if profile.onboarding_completed:
                return Response({"detail": "Опрос уже пройден"}, status=status.HTTP_400_BAD_REQUEST)

            tags_to_assign = [
                data["q1_experience"],
                data["q2_frequency"],
                data["q3_status"],
                *data["q4_directions"],
                *data.get("q5_difficulties", []),
            ]

            tags = list(Tag.objects.filter(name__in=tags_to_assign))
            found_names = {t.name for t in tags}
            missing = [t for t in tags_to_assign if t not in found_names]
            if missing:
                return Response(
                    {"detail": "Неизвестные теги", "missing": missing},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            UserTag.objects.bulk_create(
                [UserTag(user=request.user, tag=t) for t in tags],
                ignore_conflicts=True,
            )

            profile.onboarding_completed = True
            profile.onboarding_completed_at = timezone.now()
            profile.save(update_fields=["onboarding_completed", "onboarding_completed_at"])

        return Response({"completed": True, "assigned_tags": tags_to_assign})


