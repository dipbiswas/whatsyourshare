-- Add SELECTED value to SplitType enum
ALTER TYPE "SplitType" ADD VALUE 'SELECTED';

-- Add guestPayeeName to Expense (nullable, for external payees)
ALTER TABLE "Expense" ADD COLUMN "guestPayeeName" TEXT;

-- Add splitData to RecurringExpense (nullable JSON for custom split configs)
ALTER TABLE "RecurringExpense" ADD COLUMN "splitData" JSONB;
