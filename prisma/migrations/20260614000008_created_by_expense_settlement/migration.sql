ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id);
ALTER TABLE "Settlement" ADD COLUMN IF NOT EXISTS "createdById" TEXT REFERENCES "User"(id);

-- Backfill: treat paidBy as creator for existing expenses
UPDATE "Expense" SET "createdById" = "paidById" WHERE "createdById" IS NULL;

-- Backfill: treat fromUser as creator for existing settlements
UPDATE "Settlement" SET "createdById" = "fromUserId" WHERE "createdById" IS NULL;
