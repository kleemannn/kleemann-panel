-- CreateTable
CREATE TABLE "ProviderIdEntry" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderIdEntry_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add providerIdEntryId to Client
ALTER TABLE "Client" ADD COLUMN "providerIdEntryId" TEXT;

-- CreateIndex
CREATE INDEX "ProviderIdEntry_resellerId_idx" ON "ProviderIdEntry"("resellerId");

-- CreateIndex
CREATE INDEX "Client_providerIdEntryId_idx" ON "Client"("providerIdEntryId");

-- AddForeignKey
ALTER TABLE "ProviderIdEntry" ADD CONSTRAINT "ProviderIdEntry_resellerId_fkey"
    FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_providerIdEntryId_fkey"
    FOREIGN KEY ("providerIdEntryId") REFERENCES "ProviderIdEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing: for each reseller with a providerId, create a ProviderIdEntry
-- and link all their clients to it.
INSERT INTO "ProviderIdEntry" ("id", "resellerId", "providerId", "label", "createdAt")
SELECT gen_random_uuid(), "id", "providerId", NULL, NOW()
FROM "Reseller"
WHERE "providerId" IS NOT NULL AND "providerId" != '';

UPDATE "Client" c
SET "providerIdEntryId" = p."id"
FROM "ProviderIdEntry" p
WHERE p."resellerId" = c."resellerId";
