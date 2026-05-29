ALTER TYPE "OrgMemberRole" ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE "OrgMemberRole" ADD VALUE IF NOT EXISTS 'HEAD_REF';

ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "refereeClaimMode" TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS "refereeClaimLimit" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Match"
  ADD COLUMN IF NOT EXISTS "refereeClaimMode" TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS "refereeClaimLimit" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "MatchRefereeAssignment" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "userProfileId" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'assigned',
  "status" TEXT NOT NULL DEFAULT 'active',
  "assignedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatchRefereeAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchRefereeAssignment_matchId_userProfileId_key" ON "MatchRefereeAssignment"("matchId", "userProfileId");
CREATE INDEX IF NOT EXISTS "MatchRefereeAssignment_matchId_status_idx" ON "MatchRefereeAssignment"("matchId", "status");
CREATE INDEX IF NOT EXISTS "MatchRefereeAssignment_userProfileId_idx" ON "MatchRefereeAssignment"("userProfileId");

ALTER TABLE "MatchRefereeAssignment"
  ADD CONSTRAINT "MatchRefereeAssignment_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchRefereeAssignment"
  ADD CONSTRAINT "MatchRefereeAssignment_userProfileId_fkey"
  FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchRefereeAssignment"
  ADD CONSTRAINT "MatchRefereeAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
