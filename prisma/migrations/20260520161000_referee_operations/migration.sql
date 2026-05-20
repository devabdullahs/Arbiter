ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "rosterLockedAt" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "rosterLockedById" TEXT;

ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'submitted';
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Evidence" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;

CREATE TABLE IF NOT EXISTS "ScoreReport" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "teamAScore" INTEGER NOT NULL,
  "teamBScore" INTEGER NOT NULL,
  "scoringType" TEXT NOT NULL DEFAULT 'match',
  "comment" TEXT,
  "attachments" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "submittedById" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScoreReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RosterSubmission" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "teamSlot" TEXT NOT NULL,
  "teamName" TEXT NOT NULL,
  "players" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'submitted',
  "note" TEXT,
  "submittedById" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RosterSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScheduledReminder" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "matchId" TEXT,
  "kind" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "channelId" TEXT,
  "userId" TEXT,
  "payload" JSONB,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduledReminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RulebookEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "tags" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RulebookEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RosterSubmission_matchId_teamSlot_key" ON "RosterSubmission"("matchId", "teamSlot");
CREATE UNIQUE INDEX IF NOT EXISTS "RulebookEntry_organizationId_key_key" ON "RulebookEntry"("organizationId", "key");

CREATE INDEX IF NOT EXISTS "ScoreReport_organizationId_idx" ON "ScoreReport"("organizationId");
CREATE INDEX IF NOT EXISTS "ScoreReport_matchId_idx" ON "ScoreReport"("matchId");
CREATE INDEX IF NOT EXISTS "ScoreReport_status_idx" ON "ScoreReport"("status");
CREATE INDEX IF NOT EXISTS "RosterSubmission_organizationId_idx" ON "RosterSubmission"("organizationId");
CREATE INDEX IF NOT EXISTS "RosterSubmission_status_idx" ON "RosterSubmission"("status");
CREATE INDEX IF NOT EXISTS "ScheduledReminder_organizationId_idx" ON "ScheduledReminder"("organizationId");
CREATE INDEX IF NOT EXISTS "ScheduledReminder_dueAt_idx" ON "ScheduledReminder"("dueAt");
CREATE INDEX IF NOT EXISTS "ScheduledReminder_deliveredAt_idx" ON "ScheduledReminder"("deliveredAt");
CREATE INDEX IF NOT EXISTS "RulebookEntry_organizationId_idx" ON "RulebookEntry"("organizationId");

ALTER TABLE "ScoreReport" ADD CONSTRAINT "ScoreReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreReport" ADD CONSTRAINT "ScoreReport_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RosterSubmission" ADD CONSTRAINT "RosterSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RosterSubmission" ADD CONSTRAINT "RosterSubmission_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledReminder" ADD CONSTRAINT "ScheduledReminder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledReminder" ADD CONSTRAINT "ScheduledReminder_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RulebookEntry" ADD CONSTRAINT "RulebookEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
