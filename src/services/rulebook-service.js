import { prisma } from '../db/prisma.js';
import { ensureUserProfile } from './profile-service.js';

export function slugifyRuleKey(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export async function upsertRule(organizationId, input, actorUser) {
  const actor = actorUser ? await ensureUserProfile(actorUser) : null;
  const key = input.key || slugifyRuleKey(input.title);

  if (!key) {
    throw new Error('Rule title must contain at least one letter or number.');
  }

  return prisma.rulebookEntry.upsert({
    where: { organizationId_key: { organizationId, key } },
    update: {
      title: input.title,
      body: input.body,
      tags: input.tags ?? null,
    },
    create: {
      organizationId,
      key,
      title: input.title,
      body: input.body,
      tags: input.tags ?? null,
      createdById: actor?.discordUserId ?? null,
    },
  });
}

export async function searchRules(organizationId, query) {
  const q = query.trim();

  if (!q) {
    return prisma.rulebookEntry.findMany({
      where: { organizationId },
      orderBy: { title: 'asc' },
      take: 10,
    });
  }

  return prisma.rulebookEntry.findMany({
    where: {
      organizationId,
      OR: [
        { key: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
        { tags: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: { title: 'asc' },
    take: 10,
  });
}

export async function deleteRule(organizationId, key) {
  return prisma.rulebookEntry
    .delete({ where: { organizationId_key: { organizationId, key } } })
    .then(() => true)
    .catch(() => false);
}
