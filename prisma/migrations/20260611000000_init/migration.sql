-- ============================================================
-- WhatsYourShare — Full baseline migration
-- Creates ALL tables and enums from scratch.
-- ============================================================

-- ─── Enums (idempotent) ──────────────────────────────────────
DO $$ BEGIN CREATE TYPE "SplitType" AS ENUM ('EQUAL','EXACT','PERCENTAGE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ExpenseVisibility" AS ENUM ('GROUP','PAYERS_ONLY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "RecurFrequency" AS ENUM ('WEEKLY','MONTHLY','QUARTERLY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BudgetPeriod" AS ENUM ('TRIP','MONTHLY','CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FundStatus" AS ENUM ('COLLECTING','CLOSED','DISBURSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ContribStatus" AS ENUM ('PENDING','PAID','REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SettlementMethod" AS ENUM ('MANUAL','STRIPE_ACH','STRIPE_INSTANT','WISE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SettlementStatus" AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL','TEAM','ENTERPRISE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ApprovalStatus" AS ENUM ('NA','PENDING_APPROVAL','APPROVED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "UserPlan" AS ENUM ('FREE','PRO','FAMILY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CardStatus" AS ENUM ('ACTIVE','INACTIVE','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Auth tables ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "User" (
  "id"                   TEXT        NOT NULL,
  "name"                 TEXT        NOT NULL,
  "email"                TEXT        NOT NULL,
  "password"             TEXT        NOT NULL,
  "avatar"               TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  -- Stripe Connect
  "stripeConnectId"      TEXT,
  "stripeOnboarded"      BOOLEAN     NOT NULL DEFAULT false,
  -- Subscriptions
  "stripeCustomerId"     TEXT,
  "stripeSubscriptionId" TEXT,
  "plan"                 "UserPlan"  NOT NULL DEFAULT 'FREE',
  "planExpiresAt"        TIMESTAMP(3),
  -- Issuing cardholder
  "stripeCardholderId"   TEXT,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Account" (
  "id"                TEXT    NOT NULL,
  "userId"            TEXT    NOT NULL,
  "type"              TEXT    NOT NULL,
  "provider"          TEXT    NOT NULL,
  "providerAccountId" TEXT    NOT NULL,
  "refresh_token"     TEXT,
  "access_token"      TEXT,
  "expires_at"        INTEGER,
  "token_type"        TEXT,
  "scope"             TEXT,
  "id_token"          TEXT,
  "session_state"     TEXT,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider","providerAccountId");

CREATE TABLE IF NOT EXISTS "Session" (
  "id"           TEXT        NOT NULL,
  "sessionToken" TEXT        NOT NULL,
  "userId"       TEXT        NOT NULL,
  "expires"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");

CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "expires"    TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key"            ON "VerificationToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier","token");

-- ─── Groups ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Group" (
  "id"            TEXT           NOT NULL,
  "name"          TEXT           NOT NULL,
  "description"   TEXT,
  "currency"      TEXT           NOT NULL DEFAULT 'USD',
  "createdAt"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)   NOT NULL,
  "createdById"   TEXT           NOT NULL,
  "workspaceType" "WorkspaceType" NOT NULL DEFAULT 'PERSONAL',
  CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GroupMember" (
  "id"       TEXT        NOT NULL,
  "groupId"  TEXT        NOT NULL,
  "userId"   TEXT        NOT NULL,
  "role"     TEXT        NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupMember_groupId_userId_key" ON "GroupMember"("groupId","userId");

-- ─── Expenses ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Expense" (
  "id"                 TEXT                NOT NULL,
  "groupId"            TEXT                NOT NULL,
  "description"        TEXT                NOT NULL,
  "amount"             DOUBLE PRECISION    NOT NULL,
  "currency"           TEXT                NOT NULL DEFAULT 'USD',
  "category"           TEXT                NOT NULL DEFAULT 'General',
  "splitType"          "SplitType"         NOT NULL DEFAULT 'EQUAL',
  "date"               TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidById"           TEXT                NOT NULL,
  "visibility"         "ExpenseVisibility" NOT NULL DEFAULT 'GROUP',
  "approvalStatus"     "ApprovalStatus"    NOT NULL DEFAULT 'NA',
  "approvedById"       TEXT,
  "approvedAt"         TIMESTAMP(3),
  "recurringExpenseId" TEXT,
  "tripDayId"          TEXT,
  "cardTransactionId"  TEXT,
  "createdAt"          TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3)        NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_cardTransactionId_key" ON "Expense"("cardTransactionId");

CREATE TABLE IF NOT EXISTS "ExpenseSplit" (
  "id"        TEXT             NOT NULL,
  "expenseId" TEXT             NOT NULL,
  "userId"    TEXT             NOT NULL,
  "amount"    DOUBLE PRECISION NOT NULL,
  CONSTRAINT "ExpenseSplit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseSplit_expenseId_userId_key" ON "ExpenseSplit"("expenseId","userId");

-- ─── Settlements ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Settlement" (
  "id"                    TEXT              NOT NULL,
  "groupId"               TEXT              NOT NULL,
  "fromUserId"            TEXT              NOT NULL,
  "toUserId"              TEXT              NOT NULL,
  "amount"                DOUBLE PRECISION  NOT NULL,
  "currency"              TEXT              NOT NULL DEFAULT 'USD',
  "note"                  TEXT,
  "paymentMethod"         "SettlementMethod" NOT NULL DEFAULT 'MANUAL',
  "status"                "SettlementStatus" NOT NULL DEFAULT 'COMPLETED',
  "stripeTransferId"      TEXT,
  "stripePaymentIntentId" TEXT,
  "completedAt"           TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- ─── Trips ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Trip" (
  "id"          TEXT        NOT NULL,
  "groupId"     TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "destination" TEXT,
  "coverEmoji"  TEXT        DEFAULT '✈️',
  "startDate"   TIMESTAMP(3) NOT NULL,
  "endDate"     TIMESTAMP(3) NOT NULL,
  "createdById" TEXT        NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TripDay" (
  "id"     TEXT        NOT NULL,
  "tripId" TEXT        NOT NULL,
  "date"   TIMESTAMP(3) NOT NULL,
  "label"  TEXT,
  CONSTRAINT "TripDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TripDay_tripId_date_key" ON "TripDay"("tripId","date");

CREATE TABLE IF NOT EXISTS "TripFund" (
  "id"           TEXT         NOT NULL,
  "tripId"       TEXT         NOT NULL,
  "targetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency"     TEXT         NOT NULL DEFAULT 'USD',
  "status"       "FundStatus" NOT NULL DEFAULT 'COLLECTING',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripFund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TripFund_tripId_key" ON "TripFund"("tripId");

CREATE TABLE IF NOT EXISTS "FundContribution" (
  "id"               TEXT           NOT NULL,
  "fundId"           TEXT           NOT NULL,
  "userId"           TEXT           NOT NULL,
  "amount"           DOUBLE PRECISION NOT NULL,
  "currency"         TEXT           NOT NULL DEFAULT 'USD',
  "status"           "ContribStatus" NOT NULL DEFAULT 'PENDING',
  "stripeSessionId"  TEXT,
  "createdAt"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FundContribution_pkey" PRIMARY KEY ("id")
);

-- ─── Budgets ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GroupBudget" (
  "id"             TEXT           NOT NULL,
  "groupId"        TEXT           NOT NULL,
  "totalLimit"     DOUBLE PRECISION NOT NULL,
  "period"         "BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
  "startDate"      TIMESTAMP(3),
  "endDate"        TIMESTAMP(3),
  "alertThreshold" INTEGER        NOT NULL DEFAULT 80,
  "createdAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)   NOT NULL,
  CONSTRAINT "GroupBudget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupBudget_groupId_key" ON "GroupBudget"("groupId");

CREATE TABLE IF NOT EXISTS "CategoryBudget" (
  "id"       TEXT             NOT NULL,
  "budgetId" TEXT             NOT NULL,
  "category" TEXT             NOT NULL,
  "limit"    DOUBLE PRECISION NOT NULL,
  CONSTRAINT "CategoryBudget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CategoryBudget_budgetId_category_key" ON "CategoryBudget"("budgetId","category");

-- ─── Recurring expenses ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "RecurringExpense" (
  "id"          TEXT             NOT NULL,
  "groupId"     TEXT             NOT NULL,
  "description" TEXT             NOT NULL,
  "lastAmount"  DOUBLE PRECISION NOT NULL,
  "currency"    TEXT             NOT NULL DEFAULT 'USD',
  "category"    TEXT             NOT NULL DEFAULT 'General',
  "splitType"   "SplitType"      NOT NULL DEFAULT 'EQUAL',
  "frequency"   "RecurFrequency" NOT NULL DEFAULT 'MONTHLY',
  "nextDueDate" TIMESTAMP(3)     NOT NULL,
  "createdById" TEXT             NOT NULL,
  "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- ─── Expense policy (B2B) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ExpensePolicy" (
  "id"                    TEXT             NOT NULL,
  "groupId"               TEXT             NOT NULL,
  "maxAmountNoReceipt"    DOUBLE PRECISION NOT NULL DEFAULT 25,
  "requiresApprovalAbove" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "allowedCategories"     TEXT             NOT NULL DEFAULT '',
  "createdAt"             TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "ExpensePolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpensePolicy_groupId_key" ON "ExpensePolicy"("groupId");

-- ─── Virtual card (Stripe Issuing) ──────────────────────────
CREATE TABLE IF NOT EXISTS "GroupCard" (
  "id"                  TEXT        NOT NULL,
  "groupId"             TEXT        NOT NULL,
  "stripeCardId"        TEXT        NOT NULL,
  "stripeCardholderIds" TEXT        NOT NULL DEFAULT '',
  "last4"               TEXT        NOT NULL DEFAULT '',
  "brand"               TEXT        NOT NULL DEFAULT 'Visa',
  "status"              "CardStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency"            TEXT        NOT NULL DEFAULT 'USD',
  "spendLimit"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "spendLimitInterval"  TEXT        NOT NULL DEFAULT 'MONTHLY',
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupCard_groupId_key"    ON "GroupCard"("groupId");
CREATE UNIQUE INDEX IF NOT EXISTS "GroupCard_stripeCardId_key" ON "GroupCard"("stripeCardId");

CREATE TABLE IF NOT EXISTS "CardTransaction" (
  "id"               TEXT             NOT NULL,
  "groupId"          TEXT             NOT NULL,
  "cardId"           TEXT             NOT NULL,
  "userId"           TEXT,
  "amount"           DOUBLE PRECISION NOT NULL,
  "currency"         TEXT             NOT NULL DEFAULT 'usd',
  "merchantName"     TEXT             NOT NULL,
  "merchantCategory" TEXT             NOT NULL DEFAULT 'General',
  "stripeAuthId"     TEXT             NOT NULL,
  "approved"         BOOLEAN          NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CardTransaction_stripeAuthId_key" ON "CardTransaction"("stripeAuthId");

-- ─── Push subscriptions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"        TEXT        NOT NULL,
  "userId"    TEXT        NOT NULL,
  "endpoint"  TEXT        NOT NULL,
  "p256dh"    TEXT        NOT NULL,
  "auth"      TEXT        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- ─── Group invites ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GroupInvite" (
  "id"          TEXT        NOT NULL,
  "groupId"     TEXT        NOT NULL,
  "email"       TEXT        NOT NULL,
  "token"       TEXT        NOT NULL,
  "createdById" TEXT        NOT NULL,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "acceptedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupInvite_token_key" ON "GroupInvite"("token");

-- ─── Foreign keys ────────────────────────────────────────────
ALTER TABLE "Account"
  ADD CONSTRAINT "Account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "Group"
  ADD CONSTRAINT "Group_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id");

ALTER TABLE "GroupMember"
  ADD CONSTRAINT "GroupMember_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "GroupMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Expense_paidById_fkey"
    FOREIGN KEY ("paidById") REFERENCES "User"("id"),
  ADD CONSTRAINT "Expense_recurringExpenseId_fkey"
    FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id"),
  ADD CONSTRAINT "Expense_tripDayId_fkey"
    FOREIGN KEY ("tripDayId") REFERENCES "TripDay"("id"),
  ADD CONSTRAINT "Expense_cardTransactionId_fkey"
    FOREIGN KEY ("cardTransactionId") REFERENCES "CardTransaction"("id");

ALTER TABLE "ExpenseSplit"
  ADD CONSTRAINT "ExpenseSplit_expenseId_fkey"
    FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "ExpenseSplit_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id");

ALTER TABLE "Settlement"
  ADD CONSTRAINT "Settlement_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Settlement_fromUserId_fkey"
    FOREIGN KEY ("fromUserId") REFERENCES "User"("id"),
  ADD CONSTRAINT "Settlement_toUserId_fkey"
    FOREIGN KEY ("toUserId") REFERENCES "User"("id");

ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Trip_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id");

ALTER TABLE "TripDay"
  ADD CONSTRAINT "TripDay_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE;

ALTER TABLE "TripFund"
  ADD CONSTRAINT "TripFund_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE;

ALTER TABLE "FundContribution"
  ADD CONSTRAINT "FundContribution_fundId_fkey"
    FOREIGN KEY ("fundId") REFERENCES "TripFund"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "FundContribution_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id");

ALTER TABLE "GroupBudget"
  ADD CONSTRAINT "GroupBudget_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE;

ALTER TABLE "CategoryBudget"
  ADD CONSTRAINT "CategoryBudget_budgetId_fkey"
    FOREIGN KEY ("budgetId") REFERENCES "GroupBudget"("id") ON DELETE CASCADE;

ALTER TABLE "RecurringExpense"
  ADD CONSTRAINT "RecurringExpense_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "RecurringExpense_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id");

ALTER TABLE "ExpensePolicy"
  ADD CONSTRAINT "ExpensePolicy_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE;

ALTER TABLE "GroupCard"
  ADD CONSTRAINT "GroupCard_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE;

ALTER TABLE "CardTransaction"
  ADD CONSTRAINT "CardTransaction_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "GroupCard"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "CardTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

ALTER TABLE "GroupInvite"
  ADD CONSTRAINT "GroupInvite_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "GroupInvite_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id");
