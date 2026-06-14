-- Add guestMemberId to ExpenseSplit and make userId nullable
ALTER TABLE "ExpenseSplit" ADD COLUMN "guestMemberId" TEXT;
ALTER TABLE "ExpenseSplit" ALTER COLUMN "userId" DROP NOT NULL;

-- Drop old unique constraint and index (it was on non-nullable userId)
ALTER TABLE "ExpenseSplit" DROP CONSTRAINT IF EXISTS "ExpenseSplit_expenseId_userId_key";
DROP INDEX IF EXISTS "ExpenseSplit_expenseId_userId_key";

-- Recreate unique constraint as partial (only when userId is not null)
CREATE UNIQUE INDEX "ExpenseSplit_expenseId_userId_key" ON "ExpenseSplit"("expenseId", "userId") WHERE "userId" IS NOT NULL;

-- Create GuestMember table
CREATE TABLE "GuestMember" (
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

-- Foreign keys
ALTER TABLE "GuestMember" ADD CONSTRAINT "GuestMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuestMember" ADD CONSTRAINT "GuestMember_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;

ALTER TABLE "GuestMember" ADD CONSTRAINT "GuestMember_linkedUserId_fkey"
  FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExpenseSplit" ADD CONSTRAINT "ExpenseSplit_guestMemberId_fkey"
  FOREIGN KEY ("guestMemberId") REFERENCES "GuestMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
