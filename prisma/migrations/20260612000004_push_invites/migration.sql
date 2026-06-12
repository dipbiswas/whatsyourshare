-- PushSubscription: store Web Push subscriptions per user
CREATE TABLE "PushSubscription" (
  "id"        TEXT        NOT NULL,
  "userId"    TEXT        NOT NULL,
  "endpoint"  TEXT        NOT NULL,
  "p256dh"    TEXT        NOT NULL,
  "auth"      TEXT        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx"            ON "PushSubscription"("userId");
ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- GroupInvite: email-based invite links for groups
CREATE TABLE "GroupInvite" (
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
CREATE UNIQUE INDEX "GroupInvite_token_key" ON "GroupInvite"("token");
CREATE INDEX "GroupInvite_groupId_idx"      ON "GroupInvite"("groupId");
CREATE INDEX "GroupInvite_email_idx"        ON "GroupInvite"("email");
ALTER TABLE "GroupInvite"
  ADD CONSTRAINT "GroupInvite_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "GroupInvite_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id");
