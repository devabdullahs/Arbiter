-- AlterTable
ALTER TABLE "BrTeam" ADD COLUMN     "linkedTeamId" TEXT;

-- CreateIndex
CREATE INDEX "BrTeam_linkedTeamId_idx" ON "BrTeam"("linkedTeamId");

-- AddForeignKey
ALTER TABLE "BrTeam" ADD CONSTRAINT "BrTeam_linkedTeamId_fkey" FOREIGN KEY ("linkedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
