ALTER TABLE "OrgSettings"
ADD COLUMN "webPermissions" JSONB;

ALTER TABLE "UserProfile"
ADD COLUMN "bio" TEXT,
ADD COLUMN "profileVisibility" TEXT NOT NULL DEFAULT 'private',
ADD COLUMN "openToWork" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "avatarMimeType" TEXT,
ADD COLUMN "avatarSizeBytes" INTEGER,
ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);

ALTER TABLE "Team"
ADD COLUMN "captainProfileId" TEXT;

CREATE TABLE "ProfileConnectionRequest" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProfileConnectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscordSyncJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "action" TEXT NOT NULL DEFAULT 'refresh',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "claimedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiscordSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfileConnectionRequest_requesterId_targetId_key" ON "ProfileConnectionRequest"("requesterId", "targetId");
CREATE INDEX "ProfileConnectionRequest_targetId_idx" ON "ProfileConnectionRequest"("targetId");
CREATE INDEX "Team_captainProfileId_idx" ON "Team"("captainProfileId");
CREATE INDEX "DiscordSyncJob_status_createdAt_idx" ON "DiscordSyncJob"("status", "createdAt");
CREATE INDEX "DiscordSyncJob_organizationId_idx" ON "DiscordSyncJob"("organizationId");
CREATE INDEX "DiscordSyncJob_targetType_targetId_idx" ON "DiscordSyncJob"("targetType", "targetId");

ALTER TABLE "Team" ADD CONSTRAINT "Team_captainProfileId_fkey" FOREIGN KEY ("captainProfileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfileConnectionRequest" ADD CONSTRAINT "ProfileConnectionRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileConnectionRequest" ADD CONSTRAINT "ProfileConnectionRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordSyncJob" ADD CONSTRAINT "DiscordSyncJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
