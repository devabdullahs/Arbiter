ALTER TABLE "UserProfile"
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "showContactEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "socialLinks" JSONB;

CREATE TABLE "WorkerFavorite" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "priority" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkerFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkerFavorite_ownerId_workerId_key" ON "WorkerFavorite"("ownerId", "workerId");
CREATE INDEX "WorkerFavorite_workerId_idx" ON "WorkerFavorite"("workerId");

ALTER TABLE "WorkerFavorite" ADD CONSTRAINT "WorkerFavorite_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkerFavorite" ADD CONSTRAINT "WorkerFavorite_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
