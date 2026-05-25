"""Эндпоинты для текстовой генерации через OpenAI (ассоциации, случайная фраза)."""

from __future__ import annotations

import logging
import random
import re
import time
from threading import Lock

from django.conf import settings
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_app.models import AiGeneration, AiModelSetting
from platform_app.permissions import IsAdmin, OnboardingCompletedForUnsafe
from platform_app.serializers import AiModelSettingSerializer, AiModelSettingUpdateSerializer

logger = logging.getLogger(__name__)

_MODELS_CACHE_LOCK = Lock()
_MODELS_CACHE: dict | None = None
_MODELS_CACHE_MONO: float = 0.0

GEN_TYPE_ASSOCIATIONS = "association"
GEN_TYPE_RANDOM_PHRASE = "random_phrase"

# Список моделей из OpenAI API бывает огромным; оставляем то, что обычно подходит под chat.completions.
_CHAT_MODEL_ALLOW = re.compile(
    r"^(gpt-4|gpt-4o|gpt-3\.5|gpt-5|chatgpt-4o|o\d|o\d-)[-a-z0-9._]*$",
    re.IGNORECASE,
)
_CHAT_MODEL_DENY_SUBSTR = (
    "embedding",
    "embed",
    "tts",
    "whisper",
    "dall",
    "moderation",
    "transcribe",
    "realtime",
    "audio",
    "image",
    "vision",
)

ASSOCIATIONS_SYSTEM = (
    "Ты помощник художника. Пользователь даёт несколько слов или названий предметов. "
    "Свяжи их в цельное художественное описание воображаемой картины: атмосфера, композиция, цвет, детали, настроение. "
    "Пиши на русском языке. 2–4 абзаца связного текста. Без заголовков и маркированных списков. "
    "Не упоминай, что ты искусственный интеллект."
)

RANDOM_PHRASE_SYSTEM = (
    "Ты помощник для преодоления творческого кризиса. "
    "Дай одно необычное словосочетание из 2–5 слов на русском — как задание для эскиза или зарисовки. "
    "Только сама фраза, без кавычек, без пояснений и без преамбулы."
)


def _normalize_words(words) -> str:
    if words is None:
        raise serializers.ValidationError({"words": "Укажите хотя бы одно слово."})
    if isinstance(words, list):
        parts = [str(x).strip() for x in words if str(x).strip()]
    else:
        s = str(words).strip()
        if not s:
            raise serializers.ValidationError({"words": "Укажите хотя бы одно слово."})
        parts = [p.strip() for p in re.split(r"[,;\n]+", s) if p.strip()]
    if not parts:
        raise serializers.ValidationError({"words": "Укажите хотя бы одно слово."})
    parts = parts[:50]
    return ", ".join(parts)


class WordsInputSerializer(serializers.Serializer):
    words = serializers.JSONField()

    def validate_words(self, value):
        return _normalize_words(value)


class RandomPhraseInputSerializer(serializers.Serializer):
    theme = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


def _sleep_before_rate_limit_retry(attempt: int, exc: BaseException) -> None:
    """Пауза перед повтором при 429: заголовок retry-after (секунды) или экспоненциальная задержка."""
    wait_s: float | None = None
    try:
        resp = getattr(exc, "response", None)
        if resp is not None:
            h = getattr(resp, "headers", None) or {}
            ra = h.get("retry-after")
            if ra is not None:
                wait_s = float(ra)
    except (TypeError, ValueError):
        wait_s = None
    if wait_s is None or wait_s <= 0:
        # ~1s, 2s, 4s … плюс небольшой джиттер
        wait_s = (2**attempt) + random.uniform(0.0, 0.75)
    wait_s = min(wait_s, 60.0)
    time.sleep(wait_s)


def _openai_chat(system: str, user: str) -> str:
    from openai import APIError, OpenAI, RateLimitError

    if not getattr(settings, "OPENAI_API_KEY", None):
        raise RuntimeError("missing_key")

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    model = _get_active_openai_model()
    max_attempts = max(1, int(getattr(settings, "OPENAI_RATE_LIMIT_RETRIES", 4)))
    completion = None
    for attempt in range(max_attempts):
        try:
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0.85,
                max_tokens=900,
            )
            break
        except RateLimitError as e:
            if attempt >= max_attempts - 1:
                logger.warning("OpenAI rate limit (исчерпаны попытки): %s", e)
                raise RuntimeError("rate_limit") from e
            logger.info(
                "OpenAI rate limit, попытка %s/%s, повтор после паузы",
                attempt + 1,
                max_attempts,
            )
            _sleep_before_rate_limit_retry(attempt, e)
        except APIError as e:
            logger.exception("OpenAI API error")
            raise RuntimeError("api_error") from e

    if completion is None:
        raise RuntimeError("api_error")

    text = (completion.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError("empty_response")
    return text


def _openai_chat_json(system: str, user: str, *, temperature: float = 0.55) -> str:
    """Ответ модели в режиме JSON (например палитра цветов)."""
    from openai import APIError, OpenAI, RateLimitError

    if not getattr(settings, "OPENAI_API_KEY", None):
        raise RuntimeError("missing_key")

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    model = _get_active_openai_model()
    max_attempts = max(1, int(getattr(settings, "OPENAI_RATE_LIMIT_RETRIES", 4)))
    completion = None
    t = max(0.0, min(2.0, float(temperature)))
    for attempt in range(max_attempts):
        try:
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=t,
                max_tokens=1200,
                response_format={"type": "json_object"},
            )
            break
        except RateLimitError as e:
            if attempt >= max_attempts - 1:
                logger.warning("OpenAI rate limit (исчерпаны попытки): %s", e)
                raise RuntimeError("rate_limit") from e
            logger.info(
                "OpenAI rate limit, попытка %s/%s, повтор после паузы",
                attempt + 1,
                max_attempts,
            )
            _sleep_before_rate_limit_retry(attempt, e)
        except APIError as e:
            logger.exception("OpenAI API error")
            raise RuntimeError("api_error") from e

    if completion is None:
        raise RuntimeError("api_error")

    text = (completion.choices[0].message.content or "").strip()
    if not text:
        raise RuntimeError("empty_response")
    return text


class AiAssociationsView(APIView):
    """По списку слов — текстовое описание воображаемой картины (ассоциации)."""

    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def post(self, request):
        ser = WordsInputSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        normalized = ser.validated_data["words"]
        user_prompt = f"Слова и вещи: {normalized}\n\nОпиши картину, которая объединяет эти образы."

        try:
            text = _openai_chat(ASSOCIATIONS_SYSTEM, user_prompt)
        except RuntimeError as e:
            code = str(e)
            if code == "missing_key":
                return Response(
                    {"detail": "Генерация недоступна: не задан ключ OPENAI_API_KEY на сервере."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if code == "rate_limit":
                return Response(
                    {
                        "detail": (
                            "Лимит запросов к OpenAI (слишком часто или исчерпана квота). "
                            "Подождите 1–2 минуты или проверьте баланс и лимиты на platform.openai.com."
                        )
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            return Response(
                {"detail": "Не удалось получить ответ от ИИ. Попробуйте позже."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        gen = AiGeneration.objects.create(
            user=request.user,
            type=GEN_TYPE_ASSOCIATIONS,
            input_text=normalized,
            result_text=text,
        )
        return Response({"description": text, "id": gen.id, "bookmarked": False})


class AiRandomPhraseView(APIView):
    """Одно случайное словосочетание для творческого задания."""

    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def post(self, request):
        ser = RandomPhraseInputSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        theme = (ser.validated_data.get("theme") or "").strip()
        if theme:
            user_prompt = f"Тема или направление (можно игнорировать частично, если интереснее другой образ): {theme}"
        else:
            user_prompt = "Придумай новую случайную фразу."

        try:
            text = _openai_chat(RANDOM_PHRASE_SYSTEM, user_prompt)
        except RuntimeError as e:
            code = str(e)
            if code == "missing_key":
                return Response(
                    {"detail": "Генерация недоступна: не задан ключ OPENAI_API_KEY на сервере."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if code == "rate_limit":
                return Response(
                    {
                        "detail": (
                            "Лимит запросов к OpenAI (слишком часто или исчерпана квота). "
                            "Подождите 1–2 минуты или проверьте баланс и лимиты на platform.openai.com."
                        )
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            return Response(
                {"detail": "Не удалось получить ответ от ИИ. Попробуйте позже."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        gen = AiGeneration.objects.create(
            user=request.user,
            type=GEN_TYPE_RANDOM_PHRASE,
            input_text=theme,
            result_text=text,
        )
        return Response({"phrase": text, "id": gen.id, "bookmarked": False})


def _settings_fallback_model() -> str:
    return (getattr(settings, "OPENAI_MODEL", "gpt-4o-mini") or "gpt-4o-mini").strip() or "gpt-4o-mini"


def _get_or_create_ai_model_setting() -> AiModelSetting:
    obj, created = AiModelSetting.objects.get_or_create(
        singleton_key="openai_model",
        defaults={"model_name": _settings_fallback_model()},
    )
    if created and not obj.model_name:
        obj.model_name = _settings_fallback_model()
        obj.save(update_fields=["model_name", "updated_at"])
    return obj


def _get_active_openai_model() -> str:
    try:
        obj = _get_or_create_ai_model_setting()
        name = (obj.model_name or "").strip()
        if name:
            return name
    except Exception:
        logger.exception("Не удалось получить модель OpenAI из БД, используем settings")
    return _settings_fallback_model()


class AdminAiModelSettingView(APIView):
    """Текущая модель ИИ и её изменение из админ-панели."""

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        setting = _get_or_create_ai_model_setting()
        return Response(AiModelSettingSerializer(setting).data)

    def patch(self, request):
        ser = AiModelSettingUpdateSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        setting = _get_or_create_ai_model_setting()
        setting.model_name = ser.validated_data["model_name"]
        setting.save(update_fields=["model_name", "updated_at"])
        return Response(AiModelSettingSerializer(setting).data)


def _filter_chat_candidate_model_ids(raw_ids: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for mid in raw_ids:
        m = (mid or "").strip()
        if not m or m in seen:
            continue
        low = m.lower()
        if any(s in low for s in _CHAT_MODEL_DENY_SUBSTR):
            continue
        if not _CHAT_MODEL_ALLOW.match(m):
            continue
        seen.add(m)
        out.append(m)
    out.sort(key=lambda x: x.lower())
    return out


def _fetch_openai_model_ids() -> list[str]:
    from openai import APIError, OpenAI

    if not getattr(settings, "OPENAI_API_KEY", None):
        raise RuntimeError("missing_key")

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    try:
        page = client.models.list()
    except APIError:
        logger.exception("OpenAI models.list error")
        raise RuntimeError("api_error") from None

    data = getattr(page, "data", None) or []
    ids: list[str] = []
    for item in data:
        mid = getattr(item, "id", None)
        if mid:
            ids.append(str(mid))
    return _filter_chat_candidate_model_ids(ids)


def _models_cache_ttl_sec() -> float:
    try:
        return max(30.0, float(getattr(settings, "OPENAI_MODELS_LIST_CACHE_SEC", 300)))
    except (TypeError, ValueError):
        return 300.0


def get_cached_openai_chat_models(*, force_refresh: bool) -> tuple[list[str], bool, float | None]:
    """Вернуть (ids, from_cache, age_sec)."""
    global _MODELS_CACHE, _MODELS_CACHE_MONO
    ttl = _models_cache_ttl_sec()
    now = time.monotonic()
    with _MODELS_CACHE_LOCK:
        if (
            not force_refresh
            and _MODELS_CACHE is not None
            and (now - _MODELS_CACHE_MONO) < ttl
        ):
            age = now - _MODELS_CACHE_MONO
            return list(_MODELS_CACHE["ids"]), True, age
    try:
        ids = _fetch_openai_model_ids()
    except RuntimeError:
        with _MODELS_CACHE_LOCK:
            if _MODELS_CACHE is not None and not force_refresh:
                age = time.monotonic() - _MODELS_CACHE_MONO
                return list(_MODELS_CACHE["ids"]), True, age
        raise
    with _MODELS_CACHE_LOCK:
        _MODELS_CACHE = {"ids": ids}
        _MODELS_CACHE_MONO = time.monotonic()
    return ids, False, 0.0


class AdminOpenAiModelsListView(APIView):
    """Список chat-моделей, доступных ключу (OpenAI models.list), с кэшем."""

    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        refresh = str(request.query_params.get("refresh") or "").strip().lower() in (
            "1",
            "true",
            "yes",
        )
        try:
            ids, cached, age_sec = get_cached_openai_chat_models(force_refresh=refresh)
        except RuntimeError as e:
            code = str(e)
            if code == "missing_key":
                return Response(
                    {"detail": "Не задан OPENAI_API_KEY — список моделей недоступен."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            return Response(
                {"detail": "Не удалось получить список моделей от OpenAI. Попробуйте позже."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            {
                "models": [{"id": mid} for mid in ids],
                "cached": cached,
                "cache_ttl_sec": round(_models_cache_ttl_sec(), 3),
                "age_sec": round(age_sec, 3) if age_sec is not None else None,
            }
        )
