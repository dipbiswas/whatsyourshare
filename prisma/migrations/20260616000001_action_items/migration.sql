CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

CREATE TABLE "ActionItem" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tripId"      TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "assigneeId"  TEXT,
  "status"      "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
  "dueDate"     TIMESTAMP(3),
  "expenseId"   TEXT UNIQUE,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE,
  CONSTRAINT "ActionItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL,
  CONSTRAINT "ActionItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id"),
  CONSTRAINT "ActionItem_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL
);

CREATE INDEX "ActionItem_tripId_idx" ON "ActionItem"("tripId");
