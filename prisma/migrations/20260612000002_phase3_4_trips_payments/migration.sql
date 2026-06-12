-- Phase 3+4: Trips, TripDays, TripFunds, FundContributions + Expense.tripDayId

CREATE TYPE "FundStatus"   AS ENUM ('COLLECTING', 'CLOSED', 'DISBURSED');
CREATE TYPE "ContribStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- Trip
CREATE TABLE "Trip" (
  "id"          TEXT NOT NULL,
  "groupId"     TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "destination" TEXT,
  "coverEmoji"  TEXT DEFAULT '✈️',
  "startDate"   TIMESTAMP(3) NOT NULL,
  "endDate"     TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_groupId_fkey"    FOREIGN KEY ("groupId")     REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Trip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id")  ON DELETE RESTRICT ON UPDATE CASCADE;

-- TripDay
CREATE TABLE "TripDay" (
  "id"     TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "date"   TIMESTAMP(3) NOT NULL,
  "label"  TEXT,
  CONSTRAINT "TripDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TripDay_tripId_date_key" ON "TripDay"("tripId", "date");
ALTER TABLE "TripDay"
  ADD CONSTRAINT "TripDay_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add tripDayId to Expense
ALTER TABLE "Expense" ADD COLUMN "tripDayId" TEXT;
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_tripDayId_fkey"
    FOREIGN KEY ("tripDayId") REFERENCES "TripDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TripFund
CREATE TABLE "TripFund" (
  "id"           TEXT NOT NULL,
  "tripId"       TEXT NOT NULL,
  "targetAmount" DOUBLE PRECISION NOT NULL,
  "currency"     TEXT NOT NULL DEFAULT 'USD',
  "status"       "FundStatus" NOT NULL DEFAULT 'COLLECTING',
  "description"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TripFund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TripFund_tripId_key" ON "TripFund"("tripId");
ALTER TABLE "TripFund"
  ADD CONSTRAINT "TripFund_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FundContribution
CREATE TABLE "FundContribution" (
  "id"                    TEXT NOT NULL,
  "fundId"                TEXT NOT NULL,
  "userId"                TEXT NOT NULL,
  "amount"                DOUBLE PRECISION NOT NULL,
  "stripeSessionId"       TEXT,
  "stripePaymentIntentId" TEXT,
  "status"                "ContribStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt"                TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FundContribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FundContribution_stripeSessionId_key" ON "FundContribution"("stripeSessionId") WHERE "stripeSessionId" IS NOT NULL;
CREATE UNIQUE INDEX "FundContribution_fundId_userId_key"   ON "FundContribution"("fundId", "userId");
ALTER TABLE "FundContribution"
  ADD CONSTRAINT "FundContribution_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "TripFund"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FundContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")     ON DELETE RESTRICT ON UPDATE CASCADE;
