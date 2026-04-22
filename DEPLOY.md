# Production Deployment

Пошаговая установка Kleemann Panel на тот же VPS, где уже работает Remnawave,
развёрнутый скриптом [DigneZzZ/remnawave-scripts](https://github.com/DigneZzZ/remnawave-scripts)
с Caddy.

Домен из этого гайда: **`reseller.kleemannlink.online`** — если у тебя другой,
замени во всех местах.

---

## 0. Что нужно до начала

- Рабочий Remnawave Panel на VPS (от DigneZzZ, с Caddy в режиме Simple или Secure).
- DNS-запись: `reseller.kleemannlink.online` → IP твоего VPS (`A` или `AAAA`).
  Дождись распространения: `dig +short reseller.kleemannlink.online`.
- Токен Telegram-бота от [@BotFather](https://t.me/BotFather).
- API-токен Remnawave Panel (создаётся в UI самой панели: **Settings → API Tokens**).
- Твой Telegram ID для роли admin. Узнать: написать [@userinfobot](https://t.me/userinfobot).

---

## 1. Клонируем репо

```bash
sudo mkdir -p /opt/kleemann-panel
sudo chown "$USER":"$USER" /opt/kleemann-panel
cd /opt/kleemann-panel
git clone https://github.com/kleemannn/kleemann-panel.git .
```

---

## 2. Готовим `.env`

```bash
cp .env.example .env
nano .env
```

Минимум, что нужно заполнить:

```bash
NODE_ENV=production
PORT=4000
API_PREFIX=/api/v1

# Postgres — можно оставить как есть
DATABASE_URL=postgresql://kleemann:kleemann@postgres:5432/kleemann?schema=public

# JWT
JWT_SECRET=<сгенерируй: openssl rand -hex 32>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABCDEF...
ADMIN_TELEGRAM_IDS=123456789     # через запятую, если несколько

# Remnawave — ВНУТРЕННИЙ адрес панели (service name из её docker-compose).
# Проверь имя сервиса Remnawave:  docker ps --format '{{.Names}}' | grep -i remna
# Скорее всего это `remnawave` и порт 3000.
REMNAWAVE_BASE_URL=http://remnawave:3000
REMNAWAVE_TOKEN=<токен из Settings → API Tokens>

# Squad UUIDs — либо сразу сюда, либо потом через Admin UI → Squads.
SQUAD_STANDARD_UUID=
SQUAD_PREMIUM_UUID=

# CORS — наш фронт ходит на наш же backend через Caddy, так что достаточно:
CORS_ORIGINS=https://reseller.kleemannlink.online

# Какой URL использует фронт для обращения к API. Поскольку Caddy роутит
# /api/* на backend того же домена, оставляем относительный:
VITE_API_URL=/api/v1
```

Сохрани (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## 3. Подключаем нашу сеть к сети Remnawave

Наш `docker-compose.prod.yml` ожидает external network с именем `remnawave-network`.
Проверь реальное имя:

```bash
docker network ls | grep -i remna
```

Если у тебя другое имя (например `remnawave_default` или `root_default`), открой
`docker-compose.prod.yml` и поменяй:

```yaml
networks:
  remnawave:
    external: true
    name: <сюда реальное имя сети>
```

---

## 4. Поднимаем стек

```bash
cd /opt/kleemann-panel
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Проверить, что всё поднялось:

```bash
docker compose ps
docker compose logs -f backend   # Ctrl+C чтобы выйти
```

Ожидаемое: `postgres` healthy, `backend` запустил миграции Prisma и слушает `:4000`,
`frontend` слушает `:80` на nginx.

---

## 5. Добавляем Caddy-блок

Найди Caddyfile установки Remnawave (DigneZzZ-скрипт):

```bash
ls /opt/remnawave/caddy/Caddyfile 2>/dev/null || \
  find /opt -name Caddyfile 2>/dev/null
```

Открой:

```bash
sudo nano /opt/remnawave/caddy/Caddyfile   # путь подставь свой
```

Добавь **в конец файла** новый сайт:

```caddy
reseller.kleemannlink.online {
    encode zstd gzip

    # Backend API
    @api path /api/*
    handle @api {
        reverse_proxy backend:4000
    }

    # Всё остальное — фронтенд (React Mini App, serves /, /index.html, /assets, ...)
    handle {
        reverse_proxy frontend:80
    }

    # Разрешаем Telegram встраивать этот URL как Mini App.
    header {
        Content-Security-Policy "frame-ancestors https://web.telegram.org https://telegram.org 'self'"
        -Server
    }
}
```

Имена `backend` и `frontend` — это service names из нашего `docker-compose.yml`.
Они доступны для Caddy, потому что мы поместили наши контейнеры в ту же сеть
`remnawave-network` (шаг 3).

Перезагружаем Caddy:

```bash
remnawave caddy restart
# либо, если команда remnawave недоступна:
docker compose -f /opt/remnawave/caddy/docker-compose.yml restart caddy
```

Проверь, что сертификат выписался и HTTPS работает:

```bash
curl -I https://reseller.kleemannlink.online
# должен быть 200 OK и сертификат Let's Encrypt
```

---

## 6. Регистрируем Mini App в BotFather

1. Открой [@BotFather](https://t.me/BotFather) → `/mybots` → выбери нужного бота.
2. **Bot Settings → Menu Button** → **Configure Menu Button**.
3. Текст кнопки: например, `Panel`.
4. URL: `https://reseller.kleemannlink.online`.
5. (Опционально) **Bot Settings → Configure Mini App** — красивый запуск через
   inline-кнопку с Web App URL.

---

## 7. Первый вход

1. Открой бота в Telegram → нажми Menu (кнопку из шага 6).
2. Mini App загрузится, увидишь экран «Войти через Telegram». Поскольку твой ID
   есть в `ADMIN_TELEGRAM_IDS`, бэкенд сразу создаст тебя как `ADMIN`.
3. Ты попадёшь в Admin Dashboard.
4. **Admin → Squads** — проверь, что STANDARD / PREMIUM замаплены на
   правильные internal squad UUIDs Remnawave (если не заполнил в `.env`, сделай
   это здесь; дропдаун подтянет squad'ы прямо из панели).
5. **Admin → Реселлеры → Новый** — заведи первого реселлера с его Telegram ID,
   типом и квотой.

---

## 8. Обновления

```bash
cd /opt/kleemann-panel
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Миграции Prisma применяются автоматически командой, прописанной в compose
(`prisma migrate deploy` перед запуском backend).

---

## 9. Бэкап БД

```bash
docker compose exec postgres pg_dump -U kleemann kleemann \
  | gzip > /opt/kleemann-panel/backup-$(date +%F).sql.gz
```

Ресстор:

```bash
gunzip -c backup-2025-04-22.sql.gz | \
  docker compose exec -T postgres psql -U kleemann kleemann
```

---

## Troubleshooting

- **Caddy → 502 Bad Gateway.** Проверь, что backend/frontend контейнеры в той же сети, что и Caddy: `docker network inspect remnawave-network | grep -E "Name|backend|frontend|caddy"`.
- **Фронтенд загружается, но «Войти через Telegram» не работает.** Скорее всего фронт открыт не из Telegram (initData пустой). Открывай только через Menu Button бота.
- **`401 Unauthorized` при логине.** Проверь `TELEGRAM_BOT_TOKEN` — он должен быть от того же бота, к которому привязан Mini App.
- **Backend не видит Remnawave.** `docker compose exec backend wget -qO- http://remnawave:3000/api/users` (подставь твой service name). Если не отвечает — проверь имя сервиса в Remnawave compose и поправь `REMNAWAVE_BASE_URL`.
- **`403 Forbidden: Reseller account expired` при попытке создать клиента.** Админ выставил `expiresAt` в прошлом — подправь в Admin → Реселлеры.
