ALTER TABLE "Expense" ADD COLUMN "tripId" TEXT REFERENCES "Trip"("id") ON DELETE SET NULL;
CREATE INDEX "Expense_tripId_idx" ON "Expense"("tripId");
