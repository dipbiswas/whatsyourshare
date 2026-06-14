CREATE TYPE "FlagStatus" AS ENUM ('PENDING', 'DISMISSED', 'ACTIONED');
CREATE TYPE "FlagEntityType" AS ENUM ('EXPENSE', 'GROUP', 'TRIP', 'ACTION_ITEM', 'RECURRING_EXPENSE');

CREATE TABLE "ContentFlag" (
    "id"           TEXT NOT NULL,
    "entityType"   "FlagEntityType" NOT NULL,
    "entityId"     TEXT NOT NULL,
    "entitySnap"   TEXT NOT NULL,
    "reason"       TEXT NOT NULL,
    "autoFlagged"  BOOLEAN NOT NULL DEFAULT true,
    "reportedById" TEXT,
    "status"       "FlagStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt"   TIMESTAMP(3),
    "resolveNote"  TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentFlag_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ContentFlag" ADD CONSTRAINT "ContentFlag_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentFlag" ADD CONSTRAINT "ContentFlag_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ContentFlag_entityType_entityId_idx" ON "ContentFlag"("entityType", "entityId");
CREATE INDEX "ContentFlag_status_idx" ON "ContentFlag"("status");
