-- Fix TripFund: add missing description and updatedAt columns
ALTER TABLE "TripFund" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "TripFund" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Fix FundContribution: add missing stripePaymentIntentId and paidAt columns
ALTER TABLE "FundContribution" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;
ALTER TABLE "FundContribution" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
