import { prisma } from '../db/prisma.js';
import { validateRosterAccount } from './game-integrations.js';
import { getMatchRecord } from './match-service.js';
import { ensureUserProfile } from './profile-service.js';

export async function recordCheckin(input) {
  const match = await getMatchRecord(input.matchCode);

  if (!match) {
    return null;
  }

  const userProfile = await ensureUserProfile(input.user);
  const validation = await validateRosterAccount({
    gameAccount: input.gameAccount,
    organizationId: match.organizationId,
    matchId: match.id,
    userProfileId: userProfile.id,
  });

  return prisma.checkin.create({
    data: {
      organizationId: match.organizationId,
      matchId: match.id,
      userProfileId: userProfile.id,
      gameAccount: input.gameAccount,
      validation,
    },
  });
}
