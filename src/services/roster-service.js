import { prisma } from '../db/prisma.js';
import { getMatch, getMatchRecord } from './match-service.js';
import { ensureUserProfile } from './profile-service.js';

export function parseRosterPlayers(raw) {
  return raw
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function submitRoster(matchCode, input) {
  const match = await getMatchRecord(matchCode);

  if (!match) {
    return null;
  }

  if (match.rosterLockedAt) {
    throw new Error('Roster is locked for this match. Ask an admin for a substitution exception.');
  }

  const submitter = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const teamSlot = input.teamSlot;
  const teamName = teamSlot === 'team_a' ? match.teamAName : match.teamBName;
  const roster = await prisma.rosterSubmission.upsert({
    where: { matchId_teamSlot: { matchId: match.id, teamSlot } },
    update: {
      teamName,
      players: input.players,
      status: 'submitted',
      note: input.note ?? null,
      submittedById: submitter?.discordUserId ?? null,
      reviewedById: null,
      reviewedAt: null,
    },
    create: {
      organizationId: match.organizationId,
      matchId: match.id,
      teamSlot,
      teamName,
      players: input.players,
      note: input.note ?? null,
      submittedById: submitter?.discordUserId ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: match.organizationId,
      actorId: submitter?.id,
      action: 'roster.submit',
      targetType: 'roster',
      targetId: roster.id,
      metadata: { publicCode: match.publicCode, teamSlot, players: input.players },
    },
  });

  return { roster, match: await getMatch(match.publicCode) };
}

export async function listRosters(matchCode) {
  const match = await getMatchRecord(matchCode);

  if (!match) {
    return null;
  }

  const rosters = await prisma.rosterSubmission.findMany({
    where: { matchId: match.id },
    orderBy: [{ teamSlot: 'asc' }],
  });

  return { match: await getMatch(match.publicCode), rosters };
}

export async function reviewRoster(matchCode, input) {
  const match = await getMatchRecord(matchCode);

  if (!match) {
    return null;
  }

  const reviewer = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const roster = await prisma.rosterSubmission.update({
    where: { matchId_teamSlot: { matchId: match.id, teamSlot: input.teamSlot } },
    data: {
      status: input.status,
      note: input.note ?? undefined,
      reviewedById: reviewer?.discordUserId ?? null,
      reviewedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: match.organizationId,
      actorId: reviewer?.id,
      action: `roster.${input.status}`,
      targetType: 'roster',
      targetId: roster.id,
      metadata: { publicCode: match.publicCode, teamSlot: input.teamSlot, note: input.note },
    },
  });

  return { roster, match: await getMatch(match.publicCode) };
}

export async function setRosterLock(matchCode, locked, actorUser) {
  const match = await getMatchRecord(matchCode);

  if (!match) {
    return null;
  }

  const actor = actorUser ? await ensureUserProfile(actorUser) : null;
  const updated = await prisma.match.update({
    where: { id: match.id },
    data: {
      rosterLockedAt: locked ? new Date() : null,
      rosterLockedById: locked ? actor?.discordUserId ?? null : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: match.organizationId,
      actorId: actor?.id,
      action: locked ? 'roster.lock' : 'roster.unlock',
      targetType: 'match',
      targetId: match.id,
      metadata: { publicCode: match.publicCode },
    },
  });

  return getMatch(updated.publicCode);
}
