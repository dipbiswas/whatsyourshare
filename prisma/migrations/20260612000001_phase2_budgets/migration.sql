-- Phase 2: Group budgets + category budgets

CREATE TYPE "BudgetPeriod" AS ENUM ('TRIP', 'MONTHLY', 'CUSTOM');

CREATE TABLE "GroupBudget" (
  "id"          TEXT NOT NULL,
  "groupId"     TEXT NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "currency"    TEXT NOT NULL DEFAULT 'USD',
  "period"      "BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
  "startDate"   TIMESTAMP(3) NOT NULL,
  "endDate"     TIMESTAMP(3),
  "alertAt"     DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GroupBudget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GroupBudget_groupId_key" ON "GroupBudget"("groupId");

ALTER TABLE "GroupBudget"
  ADD CONSTRAINT "GroupBudget_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CategoryBudget" (
  "id"       TEXT NOT NULL,
  "budgetId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount"   DOUBLE PRECISION NOT NULL,

  CONSTRAINT "CategoryBudget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoryBudget_budgetId_category_key" ON "CategoryBudget"("budgetId", "category");

ALTER TABLE "CategoryBudget"
  ADD CONSTRAINT "CategoryBudget_budgetId_fkey"
    FOREIGN KEY ("budgetId") REFERENCES "GroupBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
