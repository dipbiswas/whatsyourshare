-- Add guestMemberId to ExpenseSplit and make userId nullable (idempotent)
ALTER TABLE "ExpenseSplit" ADD COLUMN IF NOT EXISTS "guestMemberId" TEXT;
ALTER TABLE "ExpenseSplit" ALTER COLUMN "userId" DROP NOT NULL;

-- Drop old unique constraint and index, recreate as partial (only when userId is not null)
ALTER TABLE "ExpenseSplit" DROP CONSTRAINT IF EXISTS "ExpenseSplit_expenseId_userId_key";
DROP INDEX IF EXISTS "ExpenseSplit_expenseId_userId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseSplit_expenseId_userId_key" ON "ExpenseSplit"("expenseId", "userId") WHERE "userId" IS NOT NULL;

-- Create GuestMember table
CREATE TABLE IF NOT EXISTS "GuestMember" (
  "id"           TEXT NOT NULL,
  "groupId"      TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "email"        TEXT,
  "linkedUserId" TEXT,
  "createdById"  TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuestMember_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (add only if they don't exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GuestMember_groupId_fkey') THEN
    ALTER TABLE "GuestMember" ADD CONSTRAINT "GuestMember_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GuestMember_createdById_fkey') THEN
    ALTER TABLE "GuestMember" ADD CONSTRAINT "GuestMember_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GuestMember_linkedUserId_fkey') THEN
    ALTER TABLE "GuestMember" ADD CONSTRAINT "GuestMember_linkedUserId_fkey"
      FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseSplit_guestMemberId_fkey') THEN
    ALTER TABLE "ExpenseSplit" ADD CONSTRAINT "ExpenseSplit_guestMemberId_fkey"
      FOREIGN KEY ("guestMemberId") REFERENCES "GuestMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
