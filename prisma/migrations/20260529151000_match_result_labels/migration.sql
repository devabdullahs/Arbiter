ALTER TABLE "Match" ADD COLUMN "teamAResult" TEXT;
ALTER TABLE "Match" ADD COLUMN "teamBResult" TEXT;

ALTER TABLE "MapResult" ADD COLUMN "teamAResult" TEXT;
ALTER TABLE "MapResult" ADD COLUMN "teamBResult" TEXT;

ALTER TABLE "ScoreReport" ADD COLUMN "teamAResult" TEXT;
ALTER TABLE "ScoreReport" ADD COLUMN "teamBResult" TEXT;
