-- Fix GroupBudget column names to match Prisma schema

-- Rename totalLimit -> totalAmount
ALTER TABLE "GroupBudget" RENAME COLUMN "totalLimit" TO "totalAmount";

-- Rename alertThreshold (integer, 0-100) -> alertAt (float, 0-1)
ALTER TABLE "GroupBudget" RENAME COLUMN "alertThreshold" TO "alertAt";
ALTER TABLE "GroupBudget" ALTER COLUMN "alertAt" TYPE DOUBLE PRECISION USING "alertAt"::DOUBLE PRECISION / 100;
ALTER TABLE "GroupBudget" ALTER COLUMN "alertAt" SET DEFAULT 0.8;

-- Add missing currency column
ALTER TABLE "GroupBudget" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';

-- Fix CategoryBudget: rename limit -> amount
ALTER TABLE "CategoryBudget" RENAME COLUMN "limit" TO "amount";
