"""Заполнить cover_url у материалов, где он пустой (например после добавления поддержки YouTube)."""

from django.core.management.base import BaseCommand

from platform_app.models import Material
from platform_app.utils.cover_from_url import resolve_cover_from_url


class Command(BaseCommand):
    help = "Обновляет обложки материалов с пустым cover_url по external_url"

    def handle(self, *args, **options):
        qs = Material.objects.filter(cover_url="").exclude(external_url="")
        total = qs.count()
        n = 0
        for m in qs.iterator():
            cover = resolve_cover_from_url(m.external_url)
            if cover:
                m.cover_url = cover[:2048]
                m.save(update_fields=["cover_url"])
                n += 1
                self.stdout.write(self.style.SUCCESS(f"#{m.id} {m.title[:40]}... OK"))
        self.stdout.write(self.style.NOTICE(f"Готово: обновлено {n} из {total} кандидатов."))
