-- CreateTable
CREATE TABLE "RulesPreset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mapPool" JSONB NOT NULL,
    "vetoMode" TEXT NOT NULL DEFAULT 'final_map_ban',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RulesPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RulesPreset_organizationId_idx" ON "RulesPreset"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "RulesPreset_organizationId_key_key" ON "RulesPreset"("organizationId", "key");

-- AddForeignKey
ALTER TABLE "RulesPreset" ADD CONSTRAINT "RulesPreset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
