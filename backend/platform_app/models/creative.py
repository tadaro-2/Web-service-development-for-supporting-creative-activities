from django.conf import settings
from django.db import models


class AiGeneration(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ai_generations",
    )
    type = models.CharField(max_length=64, db_index=True)
    input_text = models.TextField()
    result_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_generation"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"AiGeneration({self.pk}, {self.type})"


class Palette(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="palettes",
    )
    description = models.TextField(blank=True)
    source = models.CharField(max_length=128, blank=True)

    class Meta:
        db_table = "palette"

    def __str__(self) -> str:
        return f"Palette({self.pk})"


class PaletteColor(models.Model):
    palette = models.ForeignKey(
        Palette,
        on_delete=models.CASCADE,
        related_name="colors",
    )
    color_hex = models.CharField(max_length=16)
    # Человекочитаемое имя оттенка (например «Фуксия»), вместе с HEX для UI
    label = models.CharField(max_length=128, blank=True, default="")

    class Meta:
        db_table = "palette_color"
        ordering = ["pk"]

    def __str__(self) -> str:
        return self.color_hex


class AiModelSetting(models.Model):
    """Единая настройка модели OpenAI, которую меняет администратор."""

    singleton_key = models.CharField(max_length=64, unique=True, default="openai_model")
    model_name = models.CharField(max_length=128, default="gpt-4o-mini")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ai_model_setting"

    def __str__(self) -> str:
        return f"AiModelSetting({self.model_name})"
