import { prisma } from '../db/prisma.js';
import { ensureUserProfile } from './profile-service.js';

export function slugifyPresetKey(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function parsePresetMapPool(mapPool) {
  return mapPool
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function upsertPreset(organizationId, input, actorUser) {
  const actor = actorUser ? await ensureUserProfile(actorUser) : null;
  const key = slugifyPresetKey(input.label);

  if (!key) {
    throw new Error('Preset name must contain at least one letter or number.');
  }

  return prisma.rulesPreset.upsert({
    where: { organizationId_key: { organizationId, key } },
    update: {
      label: input.label,
      mapPool: input.mapPool,
      vetoMode: input.vetoMode,
      notes: input.notes ?? null,
    },
    create: {
      organizationId,
      key,
      label: input.label,
      mapPool: input.mapPool,
      vetoMode: input.vetoMode,
      notes: input.notes ?? null,
      createdById: actor?.id,
    },
  });
}

export async function listPresets(organizationId) {
  return prisma.rulesPreset.findMany({
    where: { organizationId },
    orderBy: { label: 'asc' },
  });
}

export async function getPreset(organizationId, key) {
  if (!organizationId || !key) {
    return null;
  }

  return prisma.rulesPreset.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
}

export async function deletePreset(organizationId, key) {
  return prisma.rulesPreset
    .delete({ where: { organizationId_key: { organizationId, key } } })
    .then(() => true)
    .catch(() => false);
}
