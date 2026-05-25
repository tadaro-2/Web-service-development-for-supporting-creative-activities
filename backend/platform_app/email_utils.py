import random
import logging

from django.conf import settings
from django.core.mail import get_connection, send_mail

logger = logging.getLogger(__name__)


def generate_verification_code() -> str:
    # 6 digits, including leading zeros
    return f"{random.randint(0, 999999):06d}"

def _domain(email: str) -> str:
    email = (email or "").strip().lower()
    if "@" not in email:
        return ""
    return email.split("@", 1)[1]

def _profile_candidates_for_email(to_email: str) -> list[str]:
    profiles = getattr(settings, "EMAIL_PROFILES", {}) or {}
    if not profiles:
        return []

    d = _domain(to_email)
    preferred: list[str] = []
    if d in {"gmail.com", "googlemail.com"} and "gmail" in profiles:
        preferred = ["gmail"]
    elif d in {"mail.ru", "inbox.ru", "bk.ru", "list.ru"} and "mailru" in profiles:
        preferred = ["mailru"]
    elif d in {"yandex.ru", "ya.ru", "yandex.com"} and "yandex" in profiles:
        preferred = ["yandex"]

    # Fallback order: preferred first, then the rest in configured order.
    rest = [name for name in profiles.keys() if name not in preferred]
    return preferred + rest

def _connection_for_profile(name: str):
    profiles = getattr(settings, "EMAIL_PROFILES", {}) or {}
    p = profiles.get(name)
    if not p:
        return None
    return get_connection(
        backend=p["backend"],
        host=p["host"],
        port=p["port"],
        username=p["host_user"],
        password=p["host_password"],
        use_tls=p["use_tls"],
        use_ssl=p["use_ssl"],
        timeout=p["timeout"],
        fail_silently=False,
    )


def send_verification_code_email(*, to_email: str, code: str) -> None:
    subject = "Подтверждение email — код"
    message = (
        "Ваш код подтверждения для регистрации:\n\n"
        f"{code}\n\n"
        "Если это были не вы — просто игнорируйте это письмо."
    )
    profiles = getattr(settings, "EMAIL_PROFILES", {}) or {}
    if not profiles:
        # Single-provider mode (uses EMAIL_* settings).
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            fail_silently=False,
        )
        return

    last_exc: Exception | None = None
    for name in _profile_candidates_for_email(to_email):
        conn = _connection_for_profile(name)
        if conn is None:
            continue
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=profiles[name]["default_from_email"],
                recipient_list=[to_email],
                fail_silently=False,
                connection=conn,
            )
            return
        except Exception as exc:
            last_exc = exc
            logger.warning("Email send failed via profile=%s: %s", name, exc)

    if last_exc:
        raise last_exc
    raise RuntimeError("No email profiles configured")

