"""Генерация цветовых палитр через OpenAI."""

from __future__ import annotations

import json
import logging
import random
import re

from django.db import transaction
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_app.api_ai import _openai_chat_json
from platform_app.models import Palette, PaletteColor
from platform_app.permissions import OnboardingCompletedForUnsafe
from platform_app.serializers import PaletteSerializer

logger = logging.getLogger(__name__)

PALETTE_JSON_SYSTEM = (
    "Ты опытный колорист и художник. Подбери одну гармоничную палитру из 5–6 цветов, которые действительно "
    "хорошо сочетаются между собой (аналоговая схема, комплементарная, триада, сплит-комплемент или монохром "
    "с разной светлотой и насыщенностью). Названия оттенков — по-русски, коротко и понятно.\n\n"
    "Верни ровно один JSON-объект без markdown и без текста вокруг. Структура:\n"
    '{"title": "краткое название палитры по-русски", "colors": ['
    '{"name": "название оттенка", "hex": "#RRGGBB"}, ...]}\n'
    "Поле hex — только строка из символа # и ровно шести шестнадцатеричных цифр (например #ca2c92)."
)

# Для запроса без темы: каждый раз другой «якорь», чтобы палитры не сходились к одной «универсальной» гамме.
_RANDOM_PALETTE_BIAS = [
    "доминируют коралл и терракота, холодный акцент допустим",
    "холодный циан, морская волна и глубокий сапфир",
    "фиолетово-розовый спектр, от лилового до фуксии",
    "жёлто-зелёная и оливковая природная гамма",
    "пыльная роза, тауп и молочный нейтраль",
    "высокий контраст: один яркий акцент на приглушённой базе",
    "пастель: лаванда, мята, персик",
    "закат: магента, мандарин, винный",
    "сине-зелёный teal как связующий, песок и графит",
    "охра, умбра, тёплый серый — земля и глина",
    "неоновый акцент (один цвет) на тёмно-сером или антраците",
    "монохром вокруг изумрудного с разной светлотой",
    "комплемент: оранжево-жёлтый против сине-фиолетового",
    "аналоговый круг вокруг чистого красного",
    "аналоговый круг вокруг жёлтого и лайма",
    "триада: равноудалённые оттенки на круге",
    "сплит-комплемент: синий + два тёплых соседа",
    "ледяные пастели: ледяной голубой, серо-голубой, жемчуг",
    "болотный, хаки, оливковый — глубокая зелень",
    "ягодный: вишня, слива, бордо",
    "мороз и металл: стальной, ледяной, холодный фиолет",
    "пустыня: песок, какао, кактусовый зелёный",
    "ретро: горчичный, бордовый, изумрудный",
    "акварель: размытые пастельные переходы в одной температуре",
    "инфракрасный акцент: малиновый и почти чёрный",
    "низкая насыщенность, «туман», почти серые цветные",
    "максимально разные оттенки, но связанные одной схемой (триада)",
    "солнечный жёлтый + индиго + нейтральный беж",
]

PALETTE_RANDOM_EXTRA_SYSTEM = (
    "\n\nЕсли пользователь просит случайную палитру без темы: каждый ответ должен заметно отличаться от предыдущих "
    "воображаемых генераций. Не повторяй одну и ту же «безопасную» нейтральную гамму (серобеж, одни и те же пастели). "
    "Используй случайный ориентир из запроса как отправную точку по оттенку и настроению — но палитра всё равно "
    "должна быть цельной по цветовой теории."
)


class PaletteGenerateInputSerializer(serializers.Serializer):
    hint = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def _normalize_hex(raw: str) -> str | None:
    s = (raw or "").strip()
    if not s:
        return None
    if not s.startswith("#"):
        s = "#" + s
    if not _HEX.match(s):
        return None
    return s.lower()


def _strip_json_fences(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        lines = s.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines)
    return s.strip()


def _parse_and_build_colors(raw_json: str) -> tuple[str, list[tuple[str, str]]]:
    """Возвращает (title, [(label, hex), ...])."""
    cleaned = _strip_json_fences(raw_json)
    data = json.loads(cleaned)
    if not isinstance(data, dict):
        raise ValueError("root_not_object")
    title = str(data.get("title") or "Сгенерированная палитра").strip()[:500]
    colors_raw = data.get("colors")
    if not isinstance(colors_raw, list) or len(colors_raw) < 4:
        raise ValueError("colors_invalid")
    out: list[tuple[str, str]] = []
    for item in colors_raw[:8]:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()[:128]
        hx = _normalize_hex(str(item.get("hex") or ""))
        if not hx:
            continue
        if not name:
            name = hx
        out.append((name, hx))
    if len(out) < 4:
        raise ValueError("too_few_colors")
    return title, out


def _ai_error_response(e: RuntimeError):
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


class PaletteGenerateView(APIView):
    """Сгенерировать палитру согласованных цветов и сохранить в БД."""

    permission_classes = [permissions.IsAuthenticated, OnboardingCompletedForUnsafe]

    def post(self, request):
        ser = PaletteGenerateInputSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        hint = (ser.validated_data.get("hint") or "").strip()
        if hint:
            system = PALETTE_JSON_SYSTEM
            user_msg = (
                f"Пожелание или настроение (можно интерпретировать свободно, главное — гармония цветов): {hint}"
            )
            temp = 0.78
        else:
            system = PALETTE_JSON_SYSTEM + PALETTE_RANDOM_EXTRA_SYSTEM
            bias = random.choice(_RANDOM_PALETTE_BIAS)
            seed = random.randint(1, 999_999_999)
            user_msg = (
                "Нужна случайная, но гармоничная палитра (без заданной темы от пользователя).\n"
                f"Случайный ориентир для ЭТОГО запроса (обязательно заложи его в выбор доминирующих оттенков): {bias}\n"
                f"Дополнительное число для разнообразия (учитывай как «сдвиг» настроения): {seed}\n"
                "Сделай палитру выразительной и отличной от типичной «универсальной беж-серой» схемы."
            )
            # Высокая температура + разный текст запроса → сильнее вариативность между нажатиями.
            temp = 1.12

        try:
            raw = _openai_chat_json(system, user_msg, temperature=temp)
        except RuntimeError as e:
            return _ai_error_response(e)

        try:
            title, color_rows = _parse_and_build_colors(raw)
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning("Palette JSON parse failed: %s", e)
            return Response(
                {"detail": "Ответ ИИ в неожиданном формате. Нажмите «Сгенерировать» ещё раз."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        with transaction.atomic():
            pal = Palette.objects.create(
                user=request.user,
                description=title,
                source="openai",
            )
            PaletteColor.objects.bulk_create(
                [PaletteColor(palette=pal, color_hex=hx, label=label) for label, hx in color_rows],
            )

        pal = Palette.objects.prefetch_related("colors").get(pk=pal.pk)
        data = PaletteSerializer(pal, context={"request": request}).data
        return Response({"palette": data, "id": pal.id, "bookmarked": False})
