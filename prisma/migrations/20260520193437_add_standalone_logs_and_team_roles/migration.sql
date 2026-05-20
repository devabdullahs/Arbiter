-- CreateTable
CREATE TABLE "StandaloneLog" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "event" TEXT,
    "teams" TEXT,
    "subject" TEXT,
    "summary" TEXT,
    "details" TEXT,
    "result" TEXT,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandaloneLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StandaloneLog_userProfileId_idx" ON "StandaloneLog"("userProfileId");

-- AddForeignKey
ALTER TABLE "StandaloneLog" ADD CONSTRAINT "StandaloneLog_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
