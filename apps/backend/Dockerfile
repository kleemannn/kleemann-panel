# Use Debian-based Node image: Prisma's native engines are shipped for
# glibc/OpenSSL 3 out of the box here. Alpine (musl) requires extra
# binaryTargets + `apk add openssl` and still trips up Prisma 5 on arm64.
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/backend/prisma apps/backend/prisma
RUN pnpm install --filter @kleemann/backend --frozen-lockfile=false
COPY apps/backend apps/backend
WORKDIR /app/apps/backend
RUN pnpm exec prisma generate
RUN pnpm build

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
# Copy the full workspace from builder so pnpm's virtual store (.pnpm) and all
# symlinks stay intact. Required because `prisma` CLI (devDependency) is needed
# at runtime for `prisma migrate deploy` and lives in the workspace's node_modules.
COPY --from=builder /app /app
WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
