import { randomUUID } from 'node:crypto';
import { defaultBrKillPoints, defaultBrPlacementPoints } from '../constants.js';
import { prisma } from '../db/prisma.js';
import { ensureUserProfile } from './profile-service.js';

const brInclude = {
  teams: { orderBy: { seed: 'asc' } },
  results: true,
  adjustments: true,
  logs: { orderBy: { createdAt: 'desc' } },
  organization: { include: { settings: true } },
};

function makeLobbyCode() {
  return `BR${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
}

export function parseTeamList(raw) {
  const seen = new Set();
  return raw
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function roleIdFromValue(value) {
  return value?.match(/\d{15,25}/)?.[0] ?? null;
}

export function parseTeamRoleMappings(raw, teamNames) {
  if (!raw) return new Map();

  const mappings = new Map();
  const ordered = teamNames.map((name) => name.toLowerCase());
  const entries = raw
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const [index, entry] of entries.entries()) {
    const separatorIndex = entry.indexOf('=');

    if (separatorIndex === -1) {
      const teamName = teamNames[index];
      const roleId = roleIdFromValue(entry);
      if (teamName && roleId) mappings.set(teamName.toLowerCase(), roleId);
      continue;
    }

    const teamName = entry.slice(0, separatorIndex).trim();
    const roleId = roleIdFromValue(entry.slice(separatorIndex + 1));

    if (!teamName || !roleId) continue;

    const key = ordered.find((name) => name === teamName.toLowerCase());
    if (key) mappings.set(key, roleId);
  }

  return mappings;
}

export function parsePlacementPoints(raw) {
  if (!raw) return null;
  const values = raw
    .split(/[\n,\s]+/)
    .map((entry) => Number(entry.trim()))
    .filter((value) => Number.isFinite(value));
  return values.length ? values : null;
}

// Parse a pasted scoreboard. Each line: "<team name> <placement> <kills>".
// The last two whitespace-separated tokens are placement and kills; the rest is the name.
export function parseResultLines(raw) {
  const entries = [];
  const invalid = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const tokens = trimmed.split(/\s+/);
    if (tokens.length < 3) {
      invalid.push(trimmed);
      continue;
    }

    const kills = Number(tokens.pop());
    const placement = Number(tokens.pop());
    const name = tokens.join(' ');

    if (!Number.isInteger(placement) || placement < 1 || !Number.isInteger(kills) || kills < 0 || !name) {
      invalid.push(trimmed);
      continue;
    }

    entries.push({ name, placement, kills });
  }

  return { entries, invalid };
}

export function pointsFor(placement, kills, placementPoints, killPoints) {
  const placePts = placement >= 1 && placement <= placementPoints.length ? placementPoints[placement - 1] : 0;
  return placePts + kills * killPoints;
}

export async function createBrLobby(input) {
  const actor = input.createdByUser ? await ensureUserProfile(input.createdByUser) : null;
  const teams = parseTeamList(input.teamsRaw ?? '');
  const roleMappings = parseTeamRoleMappings(input.teamRolesRaw, teams);

  if (teams.length < 2) {
    throw new Error('Add at least two teams (one per line or comma-separated).');
  }

  const lobby = await prisma.brLobby.create({
    data: {
      publicCode: makeLobbyCode(),
      organizationId: input.organizationId,
      channelId: input.channelId,
      createdById: actor?.id,
      name: input.name,
      game: input.game,
      gamesPlanned: input.gamesPlanned ?? 6,
      killPoints: input.killPoints ?? defaultBrKillPoints,
      placementPoints: input.placementPoints ?? defaultBrPlacementPoints,
      teams: {
        create: teams.map((name, index) => ({
          name,
          seed: index + 1,
          discordRoleId: roleMappings.get(name.toLowerCase()) ?? null,
        })),
      },
    },
    include: brInclude,
  });

  return lobby;
}

export async function getBrLobby(code) {
  if (!code) return null;

  return prisma.brLobby.findUnique({
    where: { publicCode: code.toUpperCase() },
    include: brInclude,
  });
}

export async function listBrLobbies(organizationId) {
  return prisma.brLobby.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { teams: true, results: true },
  });
}

export async function recordBrResults(code, { gameNumber, entries, byUser }) {
  const lobby = await getBrLobby(code);
  if (!lobby) return null;

  const actor = byUser ? await ensureUserProfile(byUser) : null;
  const placementPoints = Array.isArray(lobby.placementPoints) ? lobby.placementPoints : defaultBrPlacementPoints;
  const teamByName = new Map(lobby.teams.map((team) => [team.name.toLowerCase(), team]));
  const applied = [];
  const unmatched = [];

  for (const entry of entries) {
    const team = teamByName.get(entry.name.toLowerCase());
    if (!team) {
      unmatched.push(entry.name);
      continue;
    }

    const points = pointsFor(entry.placement, entry.kills, placementPoints, lobby.killPoints);
    await prisma.brGameResult.upsert({
      where: { lobbyId_brTeamId_gameNumber: { lobbyId: lobby.id, brTeamId: team.id, gameNumber } },
      update: { placement: entry.placement, kills: entry.kills, points, actorId: actor?.id },
      create: {
        lobbyId: lobby.id,
        brTeamId: team.id,
        gameNumber,
        placement: entry.placement,
        kills: entry.kills,
        points,
        actorId: actor?.id,
      },
    });
    applied.push({ team: team.name, placement: entry.placement, kills: entry.kills, points });
  }

  await prisma.brLobby.update({ where: { id: lobby.id }, data: { status: 'LIVE' } });

  return { lobby: await getBrLobby(code), applied, unmatched };
}

export async function setBrControlMessage(code, { messageId, channelId }) {
  const lobby = await getBrLobby(code);
  if (!lobby) return null;

  return prisma.brLobby.update({
    where: { id: lobby.id },
    data: { controlMessageId: messageId, channelId: channelId ?? lobby.channelId },
  });
}

export async function setBrTeamRooms(code, rooms) {
  const lobby = await getBrLobby(code);
  if (!lobby) return null;

  await prisma.$transaction(
    rooms.map((room) =>
      prisma.brTeam.update({
        where: { id: room.teamId },
        data: {
          discordRoleId: room.roleId ?? undefined,
          categoryChannelId: room.categoryChannelId ?? undefined,
          textChannelId: room.textChannelId ?? undefined,
          voiceChannelId: room.voiceChannelId ?? undefined,
          teamMessageId: room.teamMessageId ?? undefined,
        },
      }),
    ),
  );

  return getBrLobby(code);
}

export async function setBrTeamMessage(teamId, messageId) {
  return prisma.brTeam.update({
    where: { id: teamId },
    data: { teamMessageId: messageId },
  });
}

export function computeBrStandings(lobby) {
  const byTeam = new Map(
    lobby.teams.map((team) => [
      team.id,
      { id: team.id, name: team.name, points: 0, kills: 0, games: 0, bestPlacement: null, adjust: 0 },
    ]),
  );

  for (const result of lobby.results) {
    const standing = byTeam.get(result.brTeamId);
    if (!standing) continue;
    standing.points += result.points;
    standing.kills += result.kills;
    standing.games += 1;
    if (standing.bestPlacement === null || result.placement < standing.bestPlacement) {
      standing.bestPlacement = result.placement;
    }
  }

  for (const adjustment of lobby.adjustments ?? []) {
    const standing = byTeam.get(adjustment.brTeamId);
    if (!standing) continue;
    standing.points += adjustment.points;
    standing.kills += adjustment.kills;
    standing.adjust += adjustment.points;
  }

  return [...byTeam.values()].sort(
    (a, b) => b.points - a.points || b.kills - a.kills || (a.bestPlacement ?? 999) - (b.bestPlacement ?? 999),
  );
}

function resolveTeam(lobby, name) {
  if (!name) return null;
  return lobby.teams.find((team) => team.name.toLowerCase() === name.toLowerCase()) ?? null;
}

export async function addBrAdjustment(code, { teamName, points = 0, kills = 0, gameNumber, reason, byUser }) {
  const lobby = await getBrLobby(code);
  if (!lobby) return null;

  const team = resolveTeam(lobby, teamName);
  if (!team) return { lobby, team: null };

  const actor = byUser ? await ensureUserProfile(byUser) : null;
  await prisma.brAdjustment.create({
    data: { lobbyId: lobby.id, brTeamId: team.id, points, kills, gameNumber: gameNumber ?? null, reason, actorId: actor?.id },
  });

  return { lobby: await getBrLobby(code), team };
}

export async function addBrLog(code, input) {
  const lobby = await getBrLobby(code);
  if (!lobby) return null;

  const team = resolveTeam(lobby, input.teamName);

  const actor = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const log = await prisma.$transaction(async (tx) => {
    const created = await tx.brLog.create({
      data: {
        lobbyId: lobby.id,
        kind: input.kind,
        brTeamId: team?.id ?? null,
        subject: input.subject ?? null,
        gameNumber: input.gameNumber ?? null,
        summary: input.summary ?? null,
        details: input.details ?? null,
        rule: input.rule ?? null,
        durationMinutes: input.durationMinutes ?? null,
        attachmentUrl: input.attachmentUrl ?? null,
        attachmentName: input.attachmentName ?? null,
        actorId: actor?.id,
      },
    });

    if (input.kind === 'dispute') {
      await tx.brLobby.update({ where: { id: lobby.id }, data: { status: 'DISPUTED' } });
    }

    return created;
  });

  return { lobby: await getBrLobby(code), team, log };
}

export function countBrWarnings(lobby, { teamId, subject }) {
  return (lobby.logs ?? []).filter((entry) => {
    if (entry.kind !== 'warning') return false;
    if (teamId && entry.brTeamId === teamId) return true;
    if (subject && entry.subject && entry.subject.toLowerCase() === subject.toLowerCase()) return true;
    return false;
  }).length;
}

export async function closeBrLobby(code) {
  const lobby = await getBrLobby(code);
  if (!lobby) return null;

  await prisma.brLobby.update({ where: { id: lobby.id }, data: { status: 'COMPLETE' } });
  return getBrLobby(code);
}

export function gamesPlayed(lobby) {
  return lobby.results.reduce((max, result) => Math.max(max, result.gameNumber), 0);
}
