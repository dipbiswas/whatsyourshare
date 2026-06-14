CREATE UNIQUE INDEX IF NOT EXISTS "FundContribution_stripeSessionId_key" ON "FundContribution"("stripeSessionId") WHERE "stripeSessionId" IS NOT NULL;
