-- Phase 1: Recurring expenses + expense visibility

-- New enums
CREATE TYPE "ExpenseVisibility" AS ENUM ('GROUP', 'PAYERS_ONLY');
CREATE TYPE "RecurFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY');

-- New columns on Expense
ALTER TABLE "Expense"
  ADD COLUMN "visibility" "ExpenseVisibility" NOT NULL DEFAULT 'GROUP',
  ADD COLUMN "recurringExpenseId" TEXT;

-- New RecurringExpense table
CREATE TABLE "RecurringExpense" (
  "id"          TEXT NOT NULL,
  "groupId"     TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "lastAmount"  DOUBLE PRECISION NOT NULL,
  "currency"    TEXT NOT NULL DEFAULT 'USD',
  "category"    TEXT NOT NULL DEFAULT 'General',
  "splitType"   "SplitType" NOT NULL DEFAULT 'EQUAL',
  "frequency"   "RecurFrequency" NOT NULL DEFAULT 'MONTHLY',
  "nextDueDate" TIMESTAMP(3) NOT NULL,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- Foreign keys for RecurringExpense
ALTER TABLE "RecurringExpense"
  ADD CONSTRAINT "RecurringExpense_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RecurringExpense_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign key from Expense back to RecurringExpense
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_recurringExpenseId_fkey"
    FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
