"""Получение URL обложки (og:image / twitter:image) по ссылке на страницу материала."""

from __future__ import annotations

import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urljoin, urlparse
from urllib.request import Request, urlopen

# Ограничение размера HTML для разбора (защита от огромных ответов)
_MAX_HTML_BYTES = 900_000

_OG_CONTENT_FIRST = re.compile(
    r'<meta[^>]+property\s*=\s*["\']og:image["\'][^>]+content\s*=\s*["\']([^"\']+)["\']',
    re.IGNORECASE,
)
_OG_PROPERTY_FIRST = re.compile(
    r'<meta[^>]+content\s*=\s*["\']([^"\']+)["\'][^>]+property\s*=\s*["\']og:image["\']',
    re.IGNORECASE,
)
_TWITTER = re.compile(
    r'<meta[^>]+name\s*=\s*["\']twitter:image(?:\:[^"\']*)?["\'][^>]+content\s*=\s*["\']([^"\']+)["\']',
    re.IGNORECASE,
)

_IMG_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg")


def _normalize_image_url(base_page: str, raw: str) -> str | None:
    u = (raw or "").strip()
    if not u:
        return None
    if u.startswith("//"):
        u = "https:" + u
    elif u.startswith("/"):
        u = urljoin(base_page, u)
    if not u.startswith(("http://", "https://")):
        return None
    if len(u) > 2048:
        u = u[:2048]
    return u


def _looks_like_direct_image(url: str) -> bool:
    path = urlparse(url).path.lower()
    return any(path.endswith(ext) for ext in _IMG_EXT)


def _extract_youtube_video_id(url: str) -> str | None:
    """ID ролика YouTube (11 символов) или None."""
    try:
        p = urlparse(url.strip())
    except ValueError:
        return None
    netloc = (p.netloc or "").lower().split(":")[0].removeprefix("www.")
    path = (p.path or "").strip("/")
    if "youtu.be" in netloc:
        first = path.split("/")[0] if path else ""
        if len(first) >= 11:
            return first[:11]
    if "youtube" in netloc or "youtu.be" in netloc:
        q = parse_qs(p.query)
        if "v" in q and q["v"]:
            v = (q["v"][0] or "").strip()
            if len(v) >= 11:
                return v[:11]
        parts = path.split("/") if path else []
        for i, seg in enumerate(parts):
            if seg in ("embed", "shorts", "live", "v") and i + 1 < len(parts):
                cand = parts[i + 1].split("?")[0]
                if len(cand) >= 11:
                    return cand[:11]
    return None


def _youtube_thumbnail_url(page_url: str) -> str:
    vid = _extract_youtube_video_id(page_url)
    if not vid:
        return ""
    # hqdefault почти всегда есть; maxresdefault иногда отсутствует
    return f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"


def _vimeo_thumbnail_url(page_url: str, *, timeout: int) -> str:
    if "vimeo.com" not in page_url.lower():
        return ""
    api = "https://vimeo.com/api/oembed.json?url=" + quote(page_url.strip(), safe="")
    req = Request(
        api,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; UyutArt/1.0; +https://example.invalid)",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310
            raw = resp.read(120_000)
        data = json.loads(raw.decode("utf-8", errors="ignore"))
        t = (data.get("thumbnail_url") or "").strip()
        if t.startswith(("http://", "https://")):
            return t[:2048]
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError, TypeError):
        pass
    return ""


def _rutube_thumbnail_url(page_url: str, *, timeout: int) -> str:
    if "rutube.ru" not in page_url.lower():
        return ""
    api = "https://rutube.ru/api/oembed/?format=json&url=" + quote(page_url.strip(), safe="")
    req = Request(
        api,
        headers={"User-Agent": "Mozilla/5.0 (compatible; UyutArt/1.0)", "Accept": "application/json"},
        method="GET",
    )
    try:
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310
            raw = resp.read(120_000)
        data = json.loads(raw.decode("utf-8", errors="ignore"))
        t = (data.get("thumbnail_url") or "").strip()
        if t.startswith(("http://", "https://")):
            return t[:2048]
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError, TypeError):
        pass
    return ""


def resolve_cover_from_url(page_url: str, *, timeout: int = 12) -> str:
    """
    Возвращает абсолютный URL картинки обложки или пустую строку.
    Порядок: YouTube (статическое превью) → Vimeo/Rutube oEmbed → прямая картинка → og:image по HTML.
    """
    page_url = (page_url or "").strip()
    if not page_url.startswith(("http://", "https://")):
        return ""

    yt = _youtube_thumbnail_url(page_url)
    if yt:
        return yt

    vm = _vimeo_thumbnail_url(page_url, timeout=min(timeout, 15))
    if vm:
        return vm

    rt = _rutube_thumbnail_url(page_url, timeout=min(timeout, 15))
    if rt:
        return rt

    if _looks_like_direct_image(page_url):
        return page_url[:2048]

    req = Request(
        page_url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310 — осознанный запрос к URL пользователя
            content_type = (resp.headers.get("Content-Type") or "").lower()
            if content_type.startswith("image/"):
                return page_url[:2048]
            chunk = resp.read(_MAX_HTML_BYTES)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError):
        return ""

    try:
        html = chunk.decode("utf-8", errors="ignore")
    except Exception:
        return ""

    for pattern in (_OG_CONTENT_FIRST, _OG_PROPERTY_FIRST, _TWITTER):
        m = pattern.search(html)
        if m:
            img = _normalize_image_url(page_url, m.group(1))
            if img:
                return img
    return ""
