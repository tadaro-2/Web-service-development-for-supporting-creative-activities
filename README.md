# Выпускная квалификационная работа

**Тема:** разработка веб-сервиса для поддержки творческой деятельности  
**Продукт:** платформа «Уют.арт» — лента публикаций, материалы, челленджи, закладки, AI-инструменты (ассоциации, случайные фразы, палитры).

**Стек:** Django, Django REST Framework, PostgreSQL, React, TypeScript, Vite.

Репозиторий содержит исходный код клиентской и серверной частей, схему БД (`schema_core.dbml`) и конфигурацию для локального запуска.

---

## Как запустить проект (локально)

Ниже — основной способ запуска для демонстрации и проверки работы (без Docker).

### 1. Требования

- Python 3.11+
- Node.js 20+
- PostgreSQL 16 (создана БД, например `art_platform`)

### 2. База данных

Создайте базу в PostgreSQL и запомните логин/пароль. Параметры подключения задаются в `backend/.env`.

### 3. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

copy .env.example .env
```

Отредактируйте `backend/.env`: как минимум `POSTGRES_*`, при необходимости `OPENAI_API_KEY` (для AI-функций) и настройки SMTP (для отправки кодов на email).  
Если SMTP не настроен, в режиме разработки код подтверждения выводится в консоль, где запущен `runserver`.

```powershell
python manage.py migrate
python manage.py runserver
```

API будет доступен по адресу: http://127.0.0.1:8000/api/

### 4. Frontend

В **новом** терминале:

```powershell
cd frontend
npm install
npm run dev
```

Откройте в браузере: http://localhost:5173  

Запросы к `/api` и `/media` проксируются на backend через Vite (`frontend/vite.config.ts`). Отдельный `frontend/.env` не нужен.

### 5. Проверка

1. Зарегистрируйтесь и подтвердите email (код — в письме или в консоли backend).
2. Пройдите онбординг, откройте ленту, материалы, творческие инструменты.

---

## Запуск через Docker (альтернатива)

Если установлены Docker и Docker Compose:

```powershell
docker compose up --build
```

- API: http://localhost:8000/api/
- PostgreSQL: порт `5432`, PgBouncer: `6432`

Frontend по-прежнему запускается отдельно:

```powershell
cd frontend
npm install
npm run dev
```

---

## Переменные окружения

| Файл | Назначение |
|------|------------|
| `backend/.env` | секреты и настройки Django (не коммитить в git) |
| `backend/.env.example` | шаблон переменных для копирования |

Скопируйте шаблон: `backend/.env.example` → `backend/.env`.

Опционально для production-сборки frontend: `frontend/.env` с `VITE_API_BASE_URL` (по умолчанию используется `/api` через proxy Vite).

---

## Структура репозитория

```
backend/              # REST API (Django)
  platform_app/       # модели, views, API
  config/             # settings, urls
frontend/             # SPA (React)
schema_core.dbml      # логическая схема БД
docker-compose.yml    # PostgreSQL + backend в контейнерах
```

---

## Примечания для рецензента

- Файл `backend/.env` с ключами и паролями в репозиторий **не входит** (см. `.gitignore`).
- Загруженные пользователями файлы хранятся в `backend/media/` (тоже не в git).
- Для публичного демо потребуются свои ключи OpenAI и учётная запись SMTP.
