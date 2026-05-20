CREATE TYPE "OrgMemberRole" AS ENUM ('OWNER', 'ADMIN', 'REFEREE', 'PLAYER');
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'VETO', 'LIVE', 'DISPUTED', 'COMPLETE', 'CANCELLED');
CREATE TYPE "VetoKind" AS ENUM ('BAN', 'PICK');

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "discordGuildId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrgSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "adminRoleId" TEXT,
  "refereeRoleId" TEXT,
  "matchCategoryId" TEXT,
  "matchLogChannelId" TEXT,
  "evidenceChannelId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrgSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrgMember" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userProfileId" TEXT NOT NULL,
  "role" "OrgMemberRole" NOT NULL DEFAULT 'PLAYER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProfile" (
  "id" TEXT NOT NULL,
  "discordUserId" TEXT NOT NULL,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LinkedAccount" (
  "id" TEXT NOT NULL,
  "userProfileId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LinkedAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tournament" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "gameTitle" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Team" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "tournamentId" TEXT,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMember" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userProfileId" TEXT,
  "displayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Match" (
  "id" TEXT NOT NULL,
  "publicCode" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "tournamentId" TEXT,
  "channelId" TEXT,
  "createdById" TEXT,
  "teamAName" TEXT NOT NULL,
  "teamBName" TEXT NOT NULL,
  "bestOf" INTEGER NOT NULL,
  "mapPool" JSONB NOT NULL,
  "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
  "teamAScore" INTEGER NOT NULL DEFAULT 0,
  "teamBScore" INTEGER NOT NULL DEFAULT 0,
  "finalMap" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchParticipant" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "slot" TEXT NOT NULL,
  CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VetoAction" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "kind" "VetoKind" NOT NULL,
  "teamSlot" TEXT NOT NULL,
  "mapName" TEXT NOT NULL,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VetoAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefereeShift" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userProfileId" TEXT NOT NULL,
  "onShift" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefereeShift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Checkin" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "userProfileId" TEXT NOT NULL,
  "gameAccount" TEXT NOT NULL,
  "validation" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Checkin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PauseLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "teamName" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PauseLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Warning" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "player" TEXT NOT NULL,
  "rule" TEXT NOT NULL,
  "note" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Warning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Evidence" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "note" TEXT,
  "submittedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchRoom" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "textChannelId" TEXT,
  "voiceChannelId" TEXT,
  "categoryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatchRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_discordGuildId_key" ON "Organization"("discordGuildId");
CREATE UNIQUE INDEX "OrgSettings_organizationId_key" ON "OrgSettings"("organizationId");
CREATE UNIQUE INDEX "OrgMember_organizationId_userProfileId_key" ON "OrgMember"("organizationId", "userProfileId");
CREATE INDEX "OrgMember_userProfileId_idx" ON "OrgMember"("userProfileId");
CREATE UNIQUE INDEX "UserProfile_discordUserId_key" ON "UserProfile"("discordUserId");
CREATE UNIQUE INDEX "LinkedAccount_provider_handle_key" ON "LinkedAccount"("provider", "handle");
CREATE INDEX "LinkedAccount_userProfileId_idx" ON "LinkedAccount"("userProfileId");
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");
CREATE UNIQUE INDEX "Match_publicCode_key" ON "Match"("publicCode");
CREATE INDEX "Match_organizationId_idx" ON "Match"("organizationId");
CREATE INDEX "Match_status_idx" ON "Match"("status");
CREATE UNIQUE INDEX "MatchParticipant_matchId_slot_key" ON "MatchParticipant"("matchId", "slot");
CREATE INDEX "VetoAction_matchId_idx" ON "VetoAction"("matchId");
CREATE UNIQUE INDEX "RefereeShift_organizationId_userProfileId_key" ON "RefereeShift"("organizationId", "userProfileId");
CREATE INDEX "Checkin_organizationId_idx" ON "Checkin"("organizationId");
CREATE INDEX "Checkin_userProfileId_idx" ON "Checkin"("userProfileId");
CREATE INDEX "PauseLog_organizationId_idx" ON "PauseLog"("organizationId");
CREATE INDEX "Warning_organizationId_idx" ON "Warning"("organizationId");
CREATE INDEX "Evidence_organizationId_idx" ON "Evidence"("organizationId");
CREATE UNIQUE INDEX "MatchRoom_matchId_key" ON "MatchRoom"("matchId");
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

ALTER TABLE "OrgSettings" ADD CONSTRAINT "OrgSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VetoAction" ADD CONSTRAINT "VetoAction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefereeShift" ADD CONSTRAINT "RefereeShift_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefereeShift" ADD CONSTRAINT "RefereeShift_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PauseLog" ADD CONSTRAINT "PauseLog_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PauseLog" ADD CONSTRAINT "PauseLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchRoom" ADD CONSTRAINT "MatchRoom_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
