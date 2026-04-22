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
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/backend/package.json apps/backend/package.json
COPY --from=builder /app/apps/backend/prisma apps/backend/prisma
RUN pnpm install --filter @kleemann/backend --prod --frozen-lockfile=false
COPY --from=builder /app/apps/backend/dist apps/backend/dist
COPY --from=builder /app/apps/backend/node_modules apps/backend/node_modules
WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["node", "dist/main.js"]
