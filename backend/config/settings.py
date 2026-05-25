"""
Django settings for the Уют.арт platform (Django + DRF + PostgreSQL).
"""
from datetime import timedelta
from pathlib import Path
import os

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-change-in-production")

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if h.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "platform_app",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "art_platform"),
        "USER": os.environ.get("POSTGRES_USER", "postgres"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        # Keep connections open for reuse to reduce connect overhead under concurrency.
        # In production, pair with PgBouncer to cap Postgres-side connections.
        "CONN_MAX_AGE": int(os.environ.get("DJANGO_DB_CONN_MAX_AGE", "60")),
        "CONN_HEALTH_CHECKS": True,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "Europe/Moscow"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "platform_app.User"

# User-uploaded media (avatars, etc.)
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=24),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
}

# Allow both localhost and 127.0.0.1 by default (users often open either).
_cors = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors.split(",") if o.strip()]
CORS_ALLOW_CREDENTIALS = True

# Email (for verification codes). Defaults to console backend for dev.
EMAIL_BACKEND = os.environ.get(
    "DJANGO_EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
DEFAULT_FROM_EMAIL = os.environ.get("DJANGO_DEFAULT_FROM_EMAIL", "no-reply@art.local")
EMAIL_HOST = os.environ.get("DJANGO_EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("DJANGO_EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("DJANGO_EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("DJANGO_EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.environ.get("DJANGO_EMAIL_USE_TLS", "1") == "1"
EMAIL_USE_SSL = os.environ.get("DJANGO_EMAIL_USE_SSL", "0") == "1"
EMAIL_TIMEOUT = int(os.environ.get("DJANGO_EMAIL_TIMEOUT", "5"))

# Some SMTP providers use implicit TLS on 465 (SSL) instead of STARTTLS on 587 (TLS).
# Django forbids enabling both simultaneously; if SSL is enabled, disable TLS.
if EMAIL_USE_SSL:
    EMAIL_USE_TLS = False

# Multi-provider SMTP profiles (Gmail/Mail.ru/Yandex, etc.)
#
# Configure:
# - DJANGO_EMAIL_PROFILES=gmail,mailru,yandex
# - Per-profile vars, e.g. DJANGO_EMAIL_GMAIL_HOST, DJANGO_EMAIL_GMAIL_PORT, ...
#
# Email sending code can choose a profile (e.g. by recipient domain) and fallback.
EMAIL_PROFILES: dict[str, dict] = {}

_profiles_raw = os.environ.get("DJANGO_EMAIL_PROFILES", "").strip()
if _profiles_raw:
    _profile_names = [p.strip().lower() for p in _profiles_raw.split(",") if p.strip()]
else:
    _profile_names = []

def _load_email_profile(name: str) -> dict:
    upper = name.upper()
    pref = f"DJANGO_EMAIL_{upper}_"
    backend = os.environ.get(f"{pref}BACKEND", EMAIL_BACKEND)
    default_from = os.environ.get(f"{pref}DEFAULT_FROM_EMAIL", DEFAULT_FROM_EMAIL)
    host = os.environ.get(f"{pref}HOST", EMAIL_HOST)
    port = int(os.environ.get(f"{pref}PORT", str(EMAIL_PORT)))
    user = os.environ.get(f"{pref}HOST_USER", EMAIL_HOST_USER)
    password = os.environ.get(f"{pref}HOST_PASSWORD", EMAIL_HOST_PASSWORD)
    use_tls = os.environ.get(f"{pref}USE_TLS", "1" if EMAIL_USE_TLS else "0") == "1"
    use_ssl = os.environ.get(f"{pref}USE_SSL", "1" if EMAIL_USE_SSL else "0") == "1"
    timeout = int(os.environ.get(f"{pref}TIMEOUT", str(EMAIL_TIMEOUT)))

    # Django forbids enabling both simultaneously.
    if use_ssl:
        use_tls = False

    return {
        "name": name,
        "backend": backend,
        "default_from_email": default_from,
        "host": host,
        "port": port,
        "host_user": user,
        "host_password": password,
        "use_tls": use_tls,
        "use_ssl": use_ssl,
        "timeout": timeout,
    }

for _name in _profile_names:
    EMAIL_PROFILES[_name] = _load_email_profile(_name)

# OpenAI (текстовая генерация: ассоциации, случайные фразы)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
# Сколько раз повторить запрос к OpenAI при 429 (лимит RPM/TPM), с паузами между попытками
OPENAI_RATE_LIMIT_RETRIES = max(1, int(os.environ.get("OPENAI_RATE_LIMIT_RETRIES", "4")))
# Кэш списка моделей (admin/ai/models/) в секундах, минимум 30
try:
    OPENAI_MODELS_LIST_CACHE_SEC = max(30.0, float(os.environ.get("OPENAI_MODELS_LIST_CACHE_SEC", "300")))
except (TypeError, ValueError):
    OPENAI_MODELS_LIST_CACHE_SEC = 300.0
