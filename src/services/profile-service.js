import { prisma } from '../db/prisma.js';

export async function ensureUserProfile(user) {
  return prisma.userProfile.upsert({
    where: { discordUserId: user.id },
    update: { displayName: user.globalName ?? user.username ?? user.tag ?? null },
    create: {
      discordUserId: user.id,
      displayName: user.globalName ?? user.username ?? user.tag ?? null,
    },
  });
}

export async function linkAccount(user, input) {
  const profile = await ensureUserProfile(user);

  return prisma.linkedAccount.upsert({
    where: {
      provider_handle: {
        provider: input.provider.toLowerCase(),
        handle: input.handle,
      },
    },
    update: {
      userProfileId: profile.id,
      metadata: input.metadata ?? undefined,
    },
    create: {
      userProfileId: profile.id,
      provider: input.provider.toLowerCase(),
      handle: input.handle,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function getUserProfile(discordUserId) {
  return prisma.userProfile.findUnique({
    where: { discordUserId },
    include: {
      linkedAccounts: { orderBy: { createdAt: 'desc' } },
      memberships: { include: { organization: true } },
    },
  });
}
