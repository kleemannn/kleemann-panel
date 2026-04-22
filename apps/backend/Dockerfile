FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/backend/prisma apps/backend/prisma
RUN pnpm install --filter @kleemann/backend --frozen-lockfile=false
COPY apps/backend apps/backend
WORKDIR /app/apps/backend
RUN pnpm exec prisma generate
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable
# Copy the full workspace from builder so pnpm's virtual store (.pnpm) and all
# symlinks stay intact. Required because `prisma` CLI (devDependency) is needed
# at runtime for `prisma migrate deploy` and lives in the workspace's node_modules.
COPY --from=builder /app /app
WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
