-- HostIpChange table to track admin bulk IP replacements on Remnawave hosts
CREATE TABLE "HostIpChange" (
    "id" TEXT NOT NULL,
    "tag" TEXT,
    "hostUuid" TEXT,
    "previousAddress" TEXT,
    "newAddress" TEXT NOT NULL,
    "previousPort" INTEGER,
    "newPort" INTEGER,
    "hostsAffected" INTEGER NOT NULL DEFAULT 0,
    "hostsFailed" INTEGER NOT NULL DEFAULT 0,
    "performedBy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HostIpChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HostIpChange_tag_createdAt_idx" ON "HostIpChange"("tag", "createdAt");
CREATE INDEX "HostIpChange_hostUuid_createdAt_idx" ON "HostIpChange"("hostUuid", "createdAt");
