# Kleemann Panel

Telegram Mini App for VPN/Proxy resellers built on top of the [Remnawave Panel](https://docs.rw/) API.

- **Admin** creates resellers (`STANDARD` or `PREMIUM`), sets their expiration and client limits.
- **Reseller** creates VPN users. The `internal squad` is selected automatically based on reseller type; reseller picks duration and traffic limit.
- **Auth** via Telegram `initData` → JWT.
- No billing / tariffs / balances. Just accounts, quotas and Remnawave operations.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design.

## Stack

- **Backend**: NestJS 10 + Prisma 5 + PostgreSQL 16 + JWT (Telegram initData verification)
- **Frontend**: React 18 + Vite + TypeScript + Tailwind + Zustand + React Query + `@twa-dev/sdk`
- **Infra**: Docker Compose (`postgres`, `backend`, `frontend`)

## Quick start (docker-compose)

```bash
cp .env.example .env
# fill in TELEGRAM_BOT_TOKEN, REMNAWAVE_BASE_URL, REMNAWAVE_TOKEN, ADMIN_TELEGRAM_IDS, JWT_SECRET
docker compose up --build
```

- Backend: http://localhost:4000/api/v1
- Frontend: http://localhost:5173

First login: open the Mini App from Telegram as a user whose ID is listed in `ADMIN_TELEGRAM_IDS`. That account will be auto-created with role `ADMIN`.

## Local dev (without Docker)

```bash
# Prereqs: Node 20+, pnpm 9, Postgres 15+
pnpm install
cp .env.example .env
pnpm --filter @kleemann/backend exec prisma migrate dev
pnpm dev
```

`pnpm dev` starts backend (`:4000`) and frontend (`:5173`) in parallel.

## Telegram Mini App setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token into `TELEGRAM_BOT_TOKEN`.
2. `/newapp` in BotFather → point it at your frontend URL (`https://your-domain/`).
3. Add your Telegram numeric ID to `ADMIN_TELEGRAM_IDS` so you are promoted to admin on first login.

## Remnawave

The backend expects a working Remnawave Panel. In the panel:

1. Create an **API token** (section `API Tokens`) and put it into `REMNAWAVE_TOKEN`.
2. Note the **UUIDs of your two Internal Squads** (`STANDARD`, `PREMIUM`) and either:
   - put them into `SQUAD_STANDARD_UUID` / `SQUAD_PREMIUM_UUID`, or
   - leave blank and configure via Admin UI → *Squads*.

## Project layout

```
apps/
  backend/    — NestJS API (Prisma, auth, Remnawave integration)
  frontend/   — React Mini App (Tailwind + Telegram SDK)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for module breakdown and endpoint list.
