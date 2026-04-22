-- AlterTable
ALTER TABLE "Reseller" ADD COLUMN "tag" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reseller_tag_key" ON "Reseller"("tag");
