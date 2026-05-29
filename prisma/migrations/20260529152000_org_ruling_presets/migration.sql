CREATE TABLE "RulingPreset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "resultLabel" TEXT NOT NULL,
    "defaultSubjectScore" INTEGER NOT NULL DEFAULT 0,
    "defaultOpponentScore" INTEGER NOT NULL DEFAULT 0,
    "appliesTo" TEXT NOT NULL DEFAULT 'subject_loses',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RulingPreset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RulingPreset_organizationId_idx" ON "RulingPreset"("organizationId");
CREATE UNIQUE INDEX "RulingPreset_organizationId_key_key" ON "RulingPreset"("organizationId", "key");

ALTER TABLE "RulingPreset" ADD CONSTRAINT "RulingPreset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
