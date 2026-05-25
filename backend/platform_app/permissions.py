from rest_framework import permissions


class OnboardingCompletedForUnsafe(permissions.BasePermission):
    message = "Пройдите опрос, чтобы получить доступ к этой функции"

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        profile = getattr(request.user, "profile", None)
        return bool(getattr(profile, "onboarding_completed", False))


def user_is_admin(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    return bool(getattr(user, "is_staff", False) or getattr(user, "role", "") == "admin")


class IsAdmin(permissions.BasePermission):
    """Доступ для сотрудников Django или пользователей с role=admin."""

    def has_permission(self, request, view):
        return user_is_admin(request.user)
