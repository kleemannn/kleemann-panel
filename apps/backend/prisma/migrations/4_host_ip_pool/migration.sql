-- Per-tag pool of candidate IP addresses for automated host rotation.
CREATE TABLE "HostIpPool" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "addresses" JSONB NOT NULL DEFAULT '[]',
    "currentIdx" INTEGER NOT NULL DEFAULT 0,
    "port" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HostIpPool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HostIpPool_tag_key" ON "HostIpPool"("tag");
