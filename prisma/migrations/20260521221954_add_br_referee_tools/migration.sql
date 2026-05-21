-- CreateTable
CREATE TABLE "BrAdjustment" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "brTeamId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "gameNumber" INTEGER,
    "reason" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrLog" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "brTeamId" TEXT,
    "subject" TEXT,
    "gameNumber" INTEGER,
    "summary" TEXT,
    "details" TEXT,
    "rule" TEXT,
    "durationMinutes" INTEGER,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrAdjustment_lobbyId_idx" ON "BrAdjustment"("lobbyId");

-- CreateIndex
CREATE INDEX "BrLog_lobbyId_idx" ON "BrLog"("lobbyId");

-- AddForeignKey
ALTER TABLE "BrAdjustment" ADD CONSTRAINT "BrAdjustment_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "BrLobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrAdjustment" ADD CONSTRAINT "BrAdjustment_brTeamId_fkey" FOREIGN KEY ("brTeamId") REFERENCES "BrTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrLog" ADD CONSTRAINT "BrLog_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "BrLobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrLog" ADD CONSTRAINT "BrLog_brTeamId_fkey" FOREIGN KEY ("brTeamId") REFERENCES "BrTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
