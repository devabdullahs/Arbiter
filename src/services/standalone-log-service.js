import { prisma } from '../db/prisma.js';
import { ensureUserProfile } from './profile-service.js';

export async function createStandaloneLog(user, input) {
  const profile = await ensureUserProfile(user);

  return prisma.standaloneLog.create({
    data: {
      userProfileId: profile.id,
      kind: input.kind,
      event: input.event ?? null,
      teams: input.teams ?? null,
      subject: input.subject ?? null,
      summary: input.summary ?? null,
      details: input.details ?? null,
      result: input.result ?? null,
      attachmentUrl: input.attachmentUrl ?? null,
      attachmentName: input.attachmentName ?? null,
    },
  });
}

export async function listStandaloneLogs(user, { kind, limit = 10 } = {}) {
  const profile = await ensureUserProfile(user);

  return prisma.standaloneLog.findMany({
    where: { userProfileId: profile.id, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
