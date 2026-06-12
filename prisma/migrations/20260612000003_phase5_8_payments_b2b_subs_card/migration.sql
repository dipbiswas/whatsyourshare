-- Phase 5–8: Settlement payments, B2B, subscriptions, virtual card

-- New enums
CREATE TYPE "SettlementMethod" AS ENUM ('MANUAL','STRIPE_ACH','STRIPE_INSTANT','WISE');
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED');
CREATE TYPE "WorkspaceType"    AS ENUM ('PERSONAL','TEAM','ENTERPRISE');
CREATE TYPE "ApprovalStatus"   AS ENUM ('NA','PENDING_APPROVAL','APPROVED','REJECTED');
CREATE TYPE "UserPlan"         AS ENUM ('FREE','PRO','FAMILY');
CREATE TYPE "CardStatus"       AS ENUM ('ACTIVE','INACTIVE','CANCELLED');

-- User: Connect + subscription + cardholder
ALTER TABLE "User"
  ADD COLUMN "stripeConnectId"      TEXT,
  ADD COLUMN "stripeOnboarded"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripeCustomerId"     TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "plan"                 "UserPlan" NOT NULL DEFAULT 'FREE',
  ADD COLUMN "planExpiresAt"        TIMESTAMP(3),
  ADD COLUMN "stripeCardholderId"   TEXT;

-- Group: workspace type
ALTER TABLE "Group"
  ADD COLUMN "workspaceType" "WorkspaceType" NOT NULL DEFAULT 'PERSONAL';

-- Expense: approval + card transaction link
ALTER TABLE "Expense"
  ADD COLUMN "approvalStatus"    "ApprovalStatus" NOT NULL DEFAULT 'NA',
  ADD COLUMN "approvedById"      TEXT,
  ADD COLUMN "approvedAt"        TIMESTAMP(3),
  ADD COLUMN "cardTransactionId" TEXT UNIQUE;

-- Settlement: payment method + status
ALTER TABLE "Settlement"
  ADD COLUMN "paymentMethod"         "SettlementMethod" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "status"                "SettlementStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "stripeTransferId"      TEXT,
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "completedAt"           TIMESTAMP(3);

-- ExpensePolicy
CREATE TABLE "ExpensePolicy" (
  "id"                    TEXT NOT NULL,
  "groupId"               TEXT NOT NULL,
  "maxAmountNoReceipt"    DOUBLE PRECISION NOT NULL DEFAULT 25,
  "requiresApprovalAbove" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "allowedCategories"     TEXT NOT NULL DEFAULT '',
  CONSTRAINT "ExpensePolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExpensePolicy_groupId_key" ON "ExpensePolicy"("groupId");
ALTER TABLE "ExpensePolicy"
  ADD CONSTRAINT "ExpensePolicy_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE;

-- GroupCard
CREATE TABLE "GroupCard" (
  "id"                  TEXT NOT NULL,
  "groupId"             TEXT NOT NULL,
  "stripeCardId"        TEXT NOT NULL,
  "stripeCardholderIds" TEXT NOT NULL DEFAULT '',
  "last4"               TEXT NOT NULL,
  "brand"               TEXT NOT NULL DEFAULT 'Visa',
  "status"              "CardStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency"            TEXT NOT NULL DEFAULT 'usd',
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GroupCard_groupId_key"   ON "GroupCard"("groupId");
CREATE UNIQUE INDEX "GroupCard_stripeCardId_key" ON "GroupCard"("stripeCardId");
ALTER TABLE "GroupCard"
  ADD CONSTRAINT "GroupCard_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE;

-- CardTransaction
CREATE TABLE "CardTransaction" (
  "id"               TEXT NOT NULL,
  "groupId"          TEXT NOT NULL,
  "cardId"           TEXT NOT NULL,
  "userId"           TEXT,
  "amount"           DOUBLE PRECISION NOT NULL,
  "currency"         TEXT NOT NULL DEFAULT 'usd',
  "merchantName"     TEXT NOT NULL,
  "merchantCategory" TEXT NOT NULL DEFAULT 'General',
  "stripeAuthId"     TEXT NOT NULL,
  "approved"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CardTransaction_stripeAuthId_key" ON "CardTransaction"("stripeAuthId");
ALTER TABLE "CardTransaction"
  ADD CONSTRAINT "CardTransaction_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "GroupCard"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "CardTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

-- Expense → CardTransaction FK
ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_cardTransactionId_fkey"
    FOREIGN KEY ("cardTransactionId") REFERENCES "CardTransaction"("id") ON DELETE SET NULL;

-- Add spendLimit and spendLimitInterval to GroupCard
ALTER TABLE "GroupCard"
  ADD COLUMN IF NOT EXISTS "spendLimit"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "spendLimitInterval" TEXT             NOT NULL DEFAULT 'MONTHLY',
  ALTER COLUMN "last4"     SET DEFAULT '';
