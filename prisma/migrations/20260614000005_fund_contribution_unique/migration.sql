ALTER TABLE "FundContribution" ADD COLUMN IF NOT EXISTS "stripeSessionId" TEXT;
ALTER TABLE "FundContribution" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS "FundContribution_fundId_userId_key" ON "FundContribution"("fundId", "userId");
