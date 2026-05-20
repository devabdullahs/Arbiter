import { MatchStatus, VetoAction } from '../constants.js';

const statusFromDb = {
  PENDING: MatchStatus.Pending,
  VETO: MatchStatus.Veto,
  LIVE: MatchStatus.Live,
  DISPUTED: MatchStatus.Disputed,
  COMPLETE: MatchStatus.Complete,
  CANCELLED: MatchStatus.Cancelled,
};

const statusToDb = Object.fromEntries(Object.entries(statusFromDb).map(([db, app]) => [app, db]));

export function toDbStatus(status) {
  return statusToDb[status] ?? 'PENDING';
}

export function fromDbStatus(status) {
  return statusFromDb[status] ?? MatchStatus.Pending;
}

export function toDbVetoKind(kind) {
  return kind === VetoAction.Pick ? 'PICK' : 'BAN';
}

export function fromDbVetoKind(kind) {
  return kind === 'PICK' ? VetoAction.Pick : VetoAction.Ban;
}

export function toMatchView(match) {
  const vetoActions = match.vetoActions ?? [];
  const bans = vetoActions.filter((action) => action.kind === 'BAN').map(toVetoView);
  const picks = vetoActions.filter((action) => action.kind === 'PICK').map(toVetoView);
  const history = vetoActions.map(toVetoView);
  const next = nextVetoState({
    mapPool: normalizeMapPool(match.mapPool),
    bestOf: match.bestOf,
    rulesPreset: match.rulesPreset,
    vetoMode: match.vetoMode,
    bans,
    picks,
  });

  return {
    dbId: match.id,
    id: match.publicCode,
    publicCode: match.publicCode,
    organizationId: match.organizationId,
    guildId: match.organization?.discordGuildId,
    channelId: match.channelId,
    controlMessageId: match.controlMessageId,
    teamA: match.teamAName,
    teamB: match.teamBName,
    teamARoleId: match.teamARoleId ?? null,
    teamBRoleId: match.teamBRoleId ?? null,
    bestOf: match.bestOf,
    rulesPreset: match.rulesPreset ?? 'generic',
    vetoMode: match.vetoMode ?? 'final_map_ban',
    mapPool: normalizeMapPool(match.mapPool),
    status: fromDbStatus(match.status),
    allowPlayerReports: match.allowPlayerReports ?? false,
    assignedRefereeId: match.assignedRefereeId ?? null,
    disputeReason: match.disputeReason ?? null,
    rosterLockedAt: match.rosterLockedAt?.toISOString?.() ?? match.rosterLockedAt ?? null,
    rosterLockedById: match.rosterLockedById ?? null,
    rosters: (match.rosterSubmissions ?? []).map((roster) => ({
      id: roster.id,
      teamSlot: roster.teamSlot,
      teamName: roster.teamName,
      players: Array.isArray(roster.players) ? roster.players : [],
      status: roster.status,
      note: roster.note,
      submittedById: roster.submittedById,
      reviewedById: roster.reviewedById,
      reviewedAt: roster.reviewedAt?.toISOString?.() ?? roster.reviewedAt,
    })),
    score: { teamA: match.teamAScore, teamB: match.teamBScore },
    veto: {
      current: next.current,
      turn: next.turn,
      bans,
      picks,
      finalMap: match.finalMap,
      history,
    },
    room: match.room
      ? {
          textChannelId: match.room.textChannelId,
          voiceChannelId: match.room.voiceChannelId,
          categoryId: match.room.categoryId,
          playerMessageId: match.room.playerMessageId,
        }
      : null,
    settings: match.organization?.settings ?? null,
    comments: [],
    createdAt: match.createdAt?.toISOString?.() ?? match.createdAt,
    updatedAt: match.updatedAt?.toISOString?.() ?? match.updatedAt,
  };
}

export function normalizeMapPool(mapPool) {
  return Array.isArray(mapPool) ? mapPool : [];
}

export function nextVetoState(match) {
  const remaining = getRemainingMapsFromView(match);

  if (match.vetoMode === 'series_picks' || match.vetoMode === 'manual_picks') {
    const turn = (match.picks?.length ?? 0) % 2 === 0 ? 'teamA' : 'teamB';
    return { current: VetoAction.Pick, turn };
  }

  if (remaining.length <= 1) {
    return { current: VetoAction.Ban, turn: 'teamA' };
  }

  const bansNeeded = Math.max(0, match.mapPool.length - match.bestOf);
  const current = match.bans.length < bansNeeded ? VetoAction.Ban : VetoAction.Pick;
  const turn = (match.bans.length + match.picks.length) % 2 === 0 ? 'teamA' : 'teamB';

  return { current, turn };
}

export function getRemainingMapsFromView(match) {
  const usedMaps = new Set([...(match.bans ?? []), ...(match.picks ?? [])].map((entry) => entry.map));
  return match.mapPool.filter((map) => !usedMaps.has(mapNameOf(map)));
}

function toVetoView(action) {
  return {
    action: fromDbVetoKind(action.kind),
    team: action.teamSlot,
    map: action.mapName,
    at: action.createdAt?.toISOString?.() ?? action.createdAt,
  };
}

function mapNameOf(entry) {
  return typeof entry === 'string' ? entry : entry?.map;
}
