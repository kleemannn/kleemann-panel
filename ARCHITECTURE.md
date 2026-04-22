# Kleemann Panel — Architecture

Telegram Mini App поверх Remnawave Panel API для реселлеров VPN/Proxy.

## 1. Ключевые принципы

- **Admin** создаёт реселлеров двух типов — `STANDARD` и `PREMIUM` — задаёт срок и лимит клиентов.
- **Reseller** создаёт VPN-клиентов; internal squad Remnawave подставляется автоматически по типу реселлера (mapping хранится в БД / env).
- Реселлер сам выбирает срок подписки (preset 30/90/180/365 дней + custom) и лимит трафика (число GB или безлимит).
- Без биллинга, тарифов, баланса, платёжных провайдеров.
- Telegram initData → валидация HMAC → JWT (access 15m + refresh 7d).

## 2. Высокоуровневая схема

```
┌────────────────────────────────────────────────────────────┐
│                 Telegram Mini App (WebView)                │
│           React + Vite + Tailwind + @twa-dev/sdk           │
└───────────────────────┬────────────────────────────────────┘
                        │ HTTPS (JWT)
                        ▼
┌────────────────────────────────────────────────────────────┐
│               Kleemann Backend (NestJS)                    │
│  auth / me / clients / admin/resellers / admin/squads /    │
│  admin/audit / history / stats                             │
│                                                            │
│  RemnawaveService (Axios, Bearer) ──► Remnawave Panel API  │
│  PrismaService ────────────────────►  PostgreSQL 16        │
└────────────────────────────────────────────────────────────┘
```

## 3. Структура репо

```
kleemann-panel/
├── apps/
│   ├── backend/      NestJS + Prisma + JWT + Remnawave client
│   │   ├── prisma/schema.prisma
│   │   ├── prisma/seed.ts
│   │   └── src/
│   │       ├── main.ts, app.module.ts
│   │       ├── common/ (guards: jwt/roles, decorators: Public/Roles/CurrentUser, filters)
│   │       └── modules/
│   │           ├── prisma/
│   │           ├── remnawave/       ← единственное место, куда ходим во внешний API
│   │           ├── auth/            (telegram.verify.ts + AuthService + JwtStrategy)
│   │           ├── me/
│   │           ├── clients/         (CRUD + extend + disable/enable + reset + subscription)
│   │           ├── resellers/       (admin CRUD)
│   │           ├── squad-mapping/   (admin ставит uuid для STANDARD/PREMIUM)
│   │           ├── stats/
│   │           └── audit/
│   └── frontend/     React Mini App
│       └── src/
│           ├── lib/ (telegram.ts, api.ts, format.ts)
│           ├── store/auth.ts (Zustand + persist)
│           ├── hooks/useTelegramLogin.ts
│           ├── components/ (StatCard, ClientRow, BottomNav, ui/{Button,Input,Card,Select})
│           └── pages/
│               ├── Login / Dashboard / Clients / ClientDetails / CreateClient / Extend / History
│               └── admin/ (AdminDashboard, Resellers, ResellerCreate, ResellerEdit, Squads, Audit)
├── docker-compose.yml   (postgres + backend + frontend)
└── .env.example
```

## 4. Модель данных (Prisma)

```
Reseller { id, telegramId (unique), role (ADMIN|RESELLER), type (STANDARD|PREMIUM),
           maxClients, expiresAt?, isActive, username, firstName, lastName }

Client   { id, resellerId → Reseller, remnawaveUuid (unique), username (unique),
           subscriptionUrl?, expiresAt?, trafficLimitGb? (null = unlimited),
           squadUuid, status (ACTIVE|EXPIRED|DISABLED|LIMITED) }

SquadMapping { type (unique, STANDARD|PREMIUM), squadUuid, label? }

AuditLog { actor, resellerId?, action, targetId?, payload(JSON), ip?, createdAt }
```

## 5. Backend endpoints (`/api/v1`)

**Public**
- `POST /auth/telegram` — verify initData, return `{ accessToken, refreshToken, me }`
- `POST /auth/refresh`

**Reseller (JWT required)**
- `GET  /me`
- `GET  /stats/summary`
- `GET  /clients` (filters: search, status, expiringInDays)
- `GET  /clients/:id` · `POST /clients` · `PATCH /clients/:id` · `DELETE /clients/:id`
- `POST /clients/:id/extend` · `POST /clients/:id/disable` · `POST /clients/:id/enable`
- `POST /clients/:id/reset-traffic`
- `GET  /clients/:id/subscription` · `GET /clients/:id/usage`
- `GET  /history`

**Admin**
- `GET /admin/resellers` · `POST /admin/resellers` · `GET/:id` · `PATCH/:id` · `DELETE/:id`
- `GET /admin/squads` (mapping) · `PUT /admin/squads` · `GET /admin/squads/remnawave`
- `GET /admin/audit`
- `GET /stats/admin/summary`

## 6. Frontend-страницы

| Роль     | Маршрут                         | Назначение |
|----------|----------------------------------|------------|
| reseller | `/`                              | Dashboard: карточки total/active/expiringSoon/quotaRemaining, CTA «Создать» |
| reseller | `/clients`                       | Список с поиском и фильтром статуса |
| reseller | `/clients/new`                   | Создание: username, preset duration + custom, unlimited toggle / GB |
| reseller | `/clients/:id`                   | Детали, копирование subscription URL, disable/enable/reset/delete |
| reseller | `/clients/:id/extend`            | Продление на preset или custom |
| reseller | `/history`                       | Свои действия |
| admin    | `/` (AdminDashboard)             | Сводка по реселлерам и клиентам |
| admin    | `/admin/resellers`               | Список реселлеров |
| admin    | `/admin/resellers/new`           | Создание: telegramId, type, maxClients, expiresAt |
| admin    | `/admin/resellers/:id`           | Редактирование + удаление |
| admin    | `/admin/squads`                  | Настройка UUID'ов squad'ов (с подгрузкой из Remnawave) |
| admin    | `/admin/audit`                   | Глобальный лог |

## 7. Интеграция с Remnawave

`RemnawaveService` — единственный клиент к панели. Использует Bearer-токен из `REMNAWAVE_TOKEN`,
базовый URL — `REMNAWAVE_BASE_URL`. Реализованы методы:

- `createUser`, `getUserByUuid`, `listUsers`, `updateUser`, `deleteUser`
- `disableUser`, `enableUser`, `resetTraffic`
- `userUsage`
- `listInternalSquads`

Пути (`/api/users`, `/api/users/:uuid/disable`, `/api/internal-squads`, …) совпадают с
контроллерами официального Python-SDK. Перед продом сверить с `openapi.json` вашей версии
панели и скорректировать при необходимости — логика сервиса изолирует вызовы.

При создании клиента поток такой:

1. Проверка квоты (`clientsCount < maxClients`) и срока реселлера.
2. Выбор squad'а из `SquadMapping` по `reseller.type` (fallback — env).
3. `remna.createUser(...)` → получаем `uuid`, `subscriptionUrl`.
4. Запись в локальную БД.
5. **Компенсация**: если локальный insert падает, мы удаляем созданного пользователя в
   Remnawave, чтобы не было сиротских записей в панели.

## 8. Безопасность

- HMAC-SHA256 валидация Telegram `initData` (см. `telegram.verify.ts`).
- JWT (`JWT_SECRET`), роли `ADMIN`/`RESELLER`, глобальный `JwtAuthGuard` + точечный `RolesGuard` + `@Roles(Role.ADMIN)`.
- Запросы реселлера ограничены собственным `resellerId` на уровне сервиса.
- Создание реселлеров — только админ. Обычный пользователь, не занесённый в систему,
  при попытке логина получит `401` с пояснением.
- CORS whitelisted через `CORS_ORIGINS`.
- Audit: все мутации пишутся в `AuditLog` с actor, resellerId, action, payload.

## 9. Запуск

```bash
cp .env.example .env
# Заполнить TELEGRAM_BOT_TOKEN, REMNAWAVE_BASE_URL, REMNAWAVE_TOKEN,
# ADMIN_TELEGRAM_IDS, JWT_SECRET (+ опционально SQUAD_*_UUID)
docker compose up --build
```

- Backend: http://localhost:4000/api/v1
- Frontend: http://localhost:5173

Первый логин — только с telegramId из `ADMIN_TELEGRAM_IDS`. Этот аккаунт автоматически
будет создан как `ADMIN`. Дальше через Admin UI заводятся реселлеры.
