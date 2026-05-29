-- AlterTable: Tournament bracket fields
ALTER TABLE "Tournament" ADD COLUMN     "bestOf" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "championName" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'single_elimination',
ADD COLUMN     "publicCode" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "thirdPlace" BOOLEAN NOT NULL DEFAULT false;

-- Backfill publicCode for any existing tournaments, then enforce NOT NULL.
UPDATE "Tournament"
SET "publicCode" = UPPER(SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 8))
WHERE "publicCode" IS NULL;

ALTER TABLE "Tournament" ALTER COLUMN "publicCode" SET NOT NULL;

-- CreateTable
CREATE TABLE "TournamentEntry" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT,
    "teamName" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketNode" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "bracket" TEXT NOT NULL DEFAULT 'winners',
    "roundIndex" INTEGER NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "label" TEXT,
    "bestOf" INTEGER NOT NULL DEFAULT 1,
    "teamAEntryId" TEXT,
    "teamBEntryId" TEXT,
    "teamAName" TEXT,
    "teamBName" TEXT,
    "teamASource" TEXT,
    "teamBSource" TEXT,
    "teamAScore" INTEGER NOT NULL DEFAULT 0,
    "teamBScore" INTEGER NOT NULL DEFAULT 0,
    "winnerSlot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "matchId" TEXT,
    "winnerToNodeId" TEXT,
    "winnerToSlot" TEXT,
    "loserToNodeId" TEXT,
    "loserToSlot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BracketNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentEntry_tournamentId_idx" ON "TournamentEntry"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentEntry_tournamentId_seed_key" ON "TournamentEntry"("tournamentId", "seed");

-- CreateIndex
CREATE UNIQUE INDEX "BracketNode_matchId_key" ON "BracketNode"("matchId");

-- CreateIndex
CREATE INDEX "BracketNode_tournamentId_idx" ON "BracketNode"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketNode_tournamentId_bracket_roundIndex_slotIndex_key" ON "BracketNode"("tournamentId", "bracket", "roundIndex", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_publicCode_key" ON "Tournament"("publicCode");

-- CreateIndex
CREATE INDEX "Tournament_organizationId_idx" ON "Tournament"("organizationId");

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketNode" ADD CONSTRAINT "BracketNode_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketNode" ADD CONSTRAINT "BracketNode_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
