-- CreateTable
CREATE TABLE "BrLobby" (
    "id" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channelId" TEXT,
    "controlMessageId" TEXT,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "gamesPlanned" INTEGER NOT NULL DEFAULT 6,
    "killPoints" INTEGER NOT NULL DEFAULT 1,
    "placementPoints" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrLobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrTeam" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrGameResult" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "brTeamId" TEXT NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "placement" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrGameResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrLobby_publicCode_key" ON "BrLobby"("publicCode");

-- CreateIndex
CREATE INDEX "BrLobby_organizationId_idx" ON "BrLobby"("organizationId");

-- CreateIndex
CREATE INDEX "BrTeam_lobbyId_idx" ON "BrTeam"("lobbyId");

-- CreateIndex
CREATE UNIQUE INDEX "BrTeam_lobbyId_name_key" ON "BrTeam"("lobbyId", "name");

-- CreateIndex
CREATE INDEX "BrGameResult_lobbyId_idx" ON "BrGameResult"("lobbyId");

-- CreateIndex
CREATE UNIQUE INDEX "BrGameResult_lobbyId_brTeamId_gameNumber_key" ON "BrGameResult"("lobbyId", "brTeamId", "gameNumber");

-- AddForeignKey
ALTER TABLE "BrLobby" ADD CONSTRAINT "BrLobby_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrTeam" ADD CONSTRAINT "BrTeam_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "BrLobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrGameResult" ADD CONSTRAINT "BrGameResult_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "BrLobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrGameResult" ADD CONSTRAINT "BrGameResult_brTeamId_fkey" FOREIGN KEY ("brTeamId") REFERENCES "BrTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
