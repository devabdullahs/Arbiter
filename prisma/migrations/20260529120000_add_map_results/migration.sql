-- CreateTable
CREATE TABLE "MapResult" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "mapIndex" INTEGER NOT NULL,
    "mapName" TEXT NOT NULL,
    "teamAScore" INTEGER NOT NULL DEFAULT 0,
    "teamBScore" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MapResult_matchId_idx" ON "MapResult"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MapResult_matchId_mapIndex_key" ON "MapResult"("matchId", "mapIndex");

-- AddForeignKey
ALTER TABLE "MapResult" ADD CONSTRAINT "MapResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
