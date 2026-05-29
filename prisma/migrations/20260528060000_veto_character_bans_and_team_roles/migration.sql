ALTER TABLE "TeamMember" ADD COLUMN "teamRole" TEXT NOT NULL DEFAULT 'player';

ALTER TABLE "Match" ADD COLUMN "vetoStartingTeam" TEXT NOT NULL DEFAULT 'teamA';
ALTER TABLE "Match" ADD COLUMN "vetoTimerSeconds" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Match" ADD COLUMN "vetoTimeoutAction" TEXT NOT NULL DEFAULT 'referee_choice';
ALTER TABLE "Match" ADD COLUMN "characterBanMode" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Match" ADD COLUMN "characterBanTimerSeconds" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Match" ADD COLUMN "characterPool" JSONB;

ALTER TABLE "VetoAction" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'team';
ALTER TABLE "VetoAction" ADD COLUMN "note" TEXT;

CREATE TABLE "CharacterBanAction" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "teamSlot" TEXT NOT NULL,
  "character" TEXT NOT NULL,
  "gameRole" TEXT,
  "source" TEXT NOT NULL DEFAULT 'team',
  "note" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CharacterBanAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CharacterBanAction_matchId_idx" ON "CharacterBanAction"("matchId");

ALTER TABLE "CharacterBanAction" ADD CONSTRAINT "CharacterBanAction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
