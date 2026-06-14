CREATE TABLE "UsageRecord" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "feature"   TEXT NOT NULL,
  "month"     TEXT NOT NULL,
  "count"     INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UsageRecord_userId_feature_month_key" ON "UsageRecord"("userId", "feature", "month");
