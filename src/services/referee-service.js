import { prisma } from '../db/prisma.js';
import { ensureUserProfile } from './profile-service.js';

export async function setRefereeShift(organizationId, user, onShift) {
  const profile = await ensureUserProfile(user);

  return prisma.refereeShift.upsert({
    where: {
      organizationId_userProfileId: {
        organizationId,
        userProfileId: profile.id,
      },
    },
    update: { onShift },
    create: {
      organizationId,
      userProfileId: profile.id,
      onShift,
    },
  });
}

export async function getOnShiftRefereeIds(organizationId) {
  const shifts = await prisma.refereeShift.findMany({
    where: { organizationId, onShift: true },
    include: { userProfile: true },
  });

  return shifts.map((shift) => shift.userProfile.discordUserId);
}
