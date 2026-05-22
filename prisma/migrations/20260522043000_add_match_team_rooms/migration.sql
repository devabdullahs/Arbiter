ALTER TABLE "Warning" ADD COLUMN "teamName" TEXT;

ALTER TABLE "MatchRoom" ADD COLUMN "teamATextChannelId" TEXT;
ALTER TABLE "MatchRoom" ADD COLUMN "teamAVoiceChannelId" TEXT;
ALTER TABLE "MatchRoom" ADD COLUMN "teamAMessageId" TEXT;
ALTER TABLE "MatchRoom" ADD COLUMN "teamBTextChannelId" TEXT;
ALTER TABLE "MatchRoom" ADD COLUMN "teamBVoiceChannelId" TEXT;
ALTER TABLE "MatchRoom" ADD COLUMN "teamBMessageId" TEXT;
