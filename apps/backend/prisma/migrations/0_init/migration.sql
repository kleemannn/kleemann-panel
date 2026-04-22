-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RESELLER');

-- CreateEnum
CREATE TYPE "ResellerType" AS ENUM ('STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DISABLED', 'LIMITED');

-- CreateTable
CREATE TABLE "Reseller" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'RESELLER',
    "type" "ResellerType" NOT NULL DEFAULT 'STANDARD',
    "maxClients" INTEGER NOT NULL DEFAULT 50,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reseller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "remnawaveUuid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "telegramId" BIGINT,
    "note" TEXT,
    "subscriptionUrl" TEXT,
    "shortUuid" TEXT,
    "expiresAt" TIMESTAMP(3),
    "trafficLimitGb" INTEGER,
    "squadUuid" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadMapping" (
    "id" TEXT NOT NULL,
    "type" "ResellerType" NOT NULL,
    "squadUuid" TEXT NOT NULL,
    "label" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquadMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "payload" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reseller_telegramId_key" ON "Reseller"("telegramId");

-- CreateIndex
CREATE INDEX "Reseller_role_idx" ON "Reseller"("role");

-- CreateIndex
CREATE INDEX "Reseller_type_idx" ON "Reseller"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Client_remnawaveUuid_key" ON "Client"("remnawaveUuid");

-- CreateIndex
CREATE UNIQUE INDEX "Client_username_key" ON "Client"("username");

-- CreateIndex
CREATE INDEX "Client_resellerId_idx" ON "Client"("resellerId");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SquadMapping_type_key" ON "SquadMapping"("type");

-- CreateIndex
CREATE INDEX "AuditLog_resellerId_createdAt_idx" ON "AuditLog"("resellerId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

┌─────────────────────────────────────────────────────────┐
│  Update available 5.22.0 -> 7.8.0                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
