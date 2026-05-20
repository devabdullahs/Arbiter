import { randomUUID } from 'node:crypto';
import { defaultMaps, MatchStatus, overwatchMapPool, valorantMapPool, VetoAction } from '../constants.js';
import { prisma } from '../db/prisma.js';
import { ensureUserProfile } from './profile-service.js';
import { getRemainingMapsFromView, toDbStatus, toDbVetoKind, toMatchView } from '../utils/match-view.js';

function makeMatchCode() {
  return randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
}

function parseMapPool(mapPool, rulesPreset) {
  const maps = mapPool
    ?.split(',')
    .map((map) => map.trim())
    .filter(Boolean);

  if (maps?.length) {
    return maps;
  }

  if (rulesPreset === 'overwatch') {
    return overwatchMapPool;
  }

  if (rulesPreset === 'valorant') {
    return valorantMapPool;
  }

  return maps?.length ? maps : defaultMaps;
}

function defaultVetoMode(rulesPreset, bestOf) {
  // Overwatch is a pick-based series with mode rotation.
  if (rulesPreset === 'overwatch') {
    return 'series_picks';
  }

  // Valorant uses a ban/pick veto (ban down for BO1, ban + pick for series).
  if (rulesPreset === 'valorant') {
    return 'final_map_ban';
  }

  return bestOf > 1 ? 'series_picks' : 'final_map_ban';
}

const matchInclude = {
  organization: { include: { settings: true } },
  vetoActions: { orderBy: { createdAt: 'asc' } },
  room: true,
  rosterSubmissions: true,
};

export async function createMatch(input) {
  const actor = input.createdByUser ? await ensureUserProfile(input.createdByUser) : null;
  const match = await prisma.match.create({
    data: {
      publicCode: makeMatchCode(),
      organizationId: input.organizationId,
      channelId: input.channelId,
      createdById: actor?.id,
      teamAName: input.teamA,
      teamBName: input.teamB,
      bestOf: input.bestOf,
      rulesPreset: input.rulesPreset ?? 'generic',
      vetoMode: input.vetoMode ?? defaultVetoMode(input.rulesPreset, input.bestOf),
      mapPool: parseMapPool(input.mapPool, input.rulesPreset),
      allowPlayerReports: input.allowPlayerReports ?? false,
      teamARoleId: input.teamARoleId ?? null,
      teamBRoleId: input.teamBRoleId ?? null,
    },
    include: matchInclude,
  });

  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: actor?.id,
      action: 'match.create',
      targetType: 'match',
      targetId: match.id,
      metadata: { publicCode: match.publicCode },
    },
  });

  return toMatchView(match);
}

export async function getMatch(matchCode) {
  if (!matchCode) {
    return null;
  }

  const match = await prisma.match.findUnique({
    where: { publicCode: matchCode.toUpperCase() },
    include: matchInclude,
  });

  return match ? toMatchView(match) : null;
}

export async function getMatchRecord(matchCode) {
  if (!matchCode) {
    return null;
  }

  return prisma.match.findUnique({
    where: { publicCode: matchCode.toUpperCase() },
    include: matchInclude,
  });
}

export async function listMatches(organizationId) {
  const matches = await prisma.match.findMany({
    where: { organizationId },
    include: matchInclude,
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return matches.map(toMatchView);
}

export async function startVeto(matchCode) {
  const match = await prisma.match.update({
    where: { publicCode: matchCode.toUpperCase() },
    data: { status: toDbStatus(MatchStatus.Veto) },
    include: matchInclude,
  });

  return toMatchView(match);
}

export async function applyVetoAction(matchCode, mapName, actorUser) {
  const matchRecord = await getMatchRecord(matchCode);

  if (!matchRecord) {
    return null;
  }

  const match = toMatchView(matchRecord);
  const normalizedEntry = match.mapPool.find((entry) => mapNameOf(entry).toLowerCase() === mapName.toLowerCase());
  const normalizedMap = mapNameOf(normalizedEntry);

  if (!normalizedMap) {
    throw new Error('That map is not in this match map pool.');
  }

  const usedMaps = [...match.veto.bans, ...match.veto.picks].map((entry) => entry.map);

  if (usedMaps.includes(normalizedMap)) {
    throw new Error('That map has already been used in the veto.');
  }

  const actor = actorUser ? await ensureUserProfile(actorUser) : null;
  const isSeriesPick = match.vetoMode === 'series_picks' || match.vetoMode === 'manual_picks';
  const vetoKind = isSeriesPick ? VetoAction.Pick : match.veto.current;
  const remainingAfterAction = getRemainingMapsFromView({
    mapPool: match.mapPool,
    bans:
      vetoKind === VetoAction.Ban
        ? [...match.veto.bans, { map: normalizedMap }]
        : match.veto.bans,
    picks:
      vetoKind === VetoAction.Pick
        ? [...match.veto.picks, { map: normalizedMap }]
        : match.veto.picks,
  });
  const seriesComplete = match.vetoMode === 'series_picks' && match.veto.picks.length + 1 >= Math.min(match.bestOf, match.mapPool.length);
  const finalMap = isSeriesPick ? null : remainingAfterAction.length <= 1 ? remainingAfterAction[0] ?? normalizedMap : null;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.vetoAction.create({
      data: {
        matchId: matchRecord.id,
        kind: toDbVetoKind(vetoKind),
        teamSlot: match.veto.turn,
        mapName: normalizedMap,
        actorId: actor?.id,
      },
    });

    return tx.match.update({
      where: { id: matchRecord.id },
      data: {
        finalMap,
        status: finalMap || seriesComplete ? toDbStatus(MatchStatus.Pending) : toDbStatus(MatchStatus.Veto),
      },
      include: matchInclude,
    });
  });

  return toMatchView(updated);
}

export function getRemainingMaps(match) {
  let remaining = getRemainingMapsFromView({
    mapPool: match.mapPool,
    bans: match.veto.bans,
    picks: match.veto.picks,
  });

  if (match.rulesPreset === 'overwatch' && (match.vetoMode === 'series_picks' || match.vetoMode === 'manual_picks')) {
    remaining = filterOverwatchModeRotation(match, remaining);
  }

  return remaining;
}

function filterOverwatchModeRotation(match, remaining) {
  const picks = match.veto.picks;

  if (picks.length === 0) {
    return remaining.filter((entry) => mapModeOf(entry) === 'Control');
  }

  const modes = [...new Set(match.mapPool.map(mapModeOf).filter(Boolean))];
  const usedModes = new Set(picks.map((entry) => mapModeOf(findMapEntry(match.mapPool, entry.map))).filter(Boolean));
  const previousMode = mapModeOf(findMapEntry(match.mapPool, picks[picks.length - 1].map));
  const allModesPlayed = modes.every((mode) => usedModes.has(mode));

  return remaining.filter((entry) => {
    const mode = mapModeOf(entry);
    if (!mode) return true;
    if (mode === previousMode) return false;
    return allModesPlayed || !usedModes.has(mode);
  });
}

function findMapEntry(mapPool, mapName) {
  return mapPool.find((entry) => mapNameOf(entry) === mapName);
}

function mapNameOf(entry) {
  return typeof entry === 'string' ? entry : entry?.map;
}

function mapModeOf(entry) {
  return typeof entry === 'object' && entry ? entry.mode : null;
}

export async function setMatchLive(matchCode, room) {
  const record = await getMatchRecord(matchCode);

  if (!record) {
    return null;
  }

  const updated = await prisma.match.update({
    where: { id: record.id },
    data: {
      status: toDbStatus(MatchStatus.Live),
      room: {
        upsert: {
          create: room,
          update: room,
        },
      },
    },
    include: matchInclude,
  });

  return toMatchView(updated);
}

export async function setControlMessage(matchCode, message) {
  const record = await getMatchRecord(matchCode);

  if (!record) {
    return null;
  }

  const updated = await prisma.match.update({
    where: { id: record.id },
    data: {
      controlMessageId: message.messageId,
      channelId: message.channelId ?? record.channelId,
    },
    include: matchInclude,
  });

  return toMatchView(updated);
}

export async function setPlayerMessage(matchCode, messageId) {
  const record = await getMatchRecord(matchCode);

  if (!record) {
    return null;
  }

  const updated = await prisma.match.update({
    where: { id: record.id },
    data: {
      room: {
        upsert: {
          create: { playerMessageId: messageId },
          update: { playerMessageId: messageId },
        },
      },
    },
    include: matchInclude,
  });

  return toMatchView(updated);
}

export async function logScore(matchCode, input) {
  const record = await getMatchRecord(matchCode);

  if (!record) {
    return null;
  }

  const actor = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        organizationId: record.organizationId,
        actorId: actor?.id,
        action: 'match.score',
        targetType: 'match',
        targetId: record.id,
        metadata: {
          teamAScore: Number(input.teamAScore),
          teamBScore: Number(input.teamBScore),
          scoringType: input.scoringType ?? 'match',
          comment: input.comment,
          attachments: input.attachments ?? [],
        },
      },
    });

    for (const attachment of input.attachments ?? []) {
      await tx.evidence.create({
        data: {
          organizationId: record.organizationId,
          matchId: record.id,
          url: attachment.url,
          note: attachment.name ? `Score screenshot: ${attachment.name}` : 'Score screenshot',
          submittedById: actor?.id,
        },
      });
    }

    const scoringType = input.scoringType ?? 'match';

    return tx.match.update({
      where: { id: record.id },
      data: {
        teamAScore: Number(input.teamAScore),
        teamBScore: Number(input.teamBScore),
        status: scoringType === 'match' ? toDbStatus(MatchStatus.Complete) : record.status,
      },
      include: matchInclude,
    });
  });

  return toMatchView(updated);
}

export async function logPause(matchCode, input) {
  const record = await getMatchRecord(matchCode);

  if (!record) {
    return null;
  }

  const actor = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const pause = await prisma.pauseLog.create({
    data: {
      organizationId: record.organizationId,
      matchId: record.id,
      pauseType: input.pauseType ?? 'team',
      teamName: input.team || null,
      durationMinutes: Number(input.durationMinutes),
      reason: input.reason,
      actorId: actor?.id,
    },
  });

  return { match: await getMatch(matchCode), pause };
}

export async function applyMatchRuling(matchCode, input) {
  const record = await getMatchRecord(matchCode);

  if (!record) {
    return null;
  }

  const actor = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        organizationId: record.organizationId,
        actorId: actor?.id,
        action: `match.ruling.${input.ruling}`,
        targetType: 'match',
        targetId: record.id,
        metadata: {
          affectedTeam: input.team,
          reason: input.reason,
        },
      },
    });

    return tx.match.update({
      where: { id: record.id },
      data: {
        status: input.ruling === 'cancelled' ? toDbStatus(MatchStatus.Cancelled) : toDbStatus(MatchStatus.Complete),
      },
      include: matchInclude,
    });
  });

  return toMatchView(updated);
}

export async function logWarning(matchCode, input) {
  const record = await getMatchRecord(matchCode);

  if (!record) {
    return null;
  }

  const actor = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const warning = await prisma.$transaction(async (tx) => {
    const created = await tx.warning.create({
      data: {
        organizationId: record.organizationId,
        matchId: record.id,
        player: input.player,
        rule: input.rule,
        note: input.note,
        actorId: actor?.id,
      },
    });

    for (const attachment of input.attachments ?? []) {
      await tx.evidence.create({
        data: {
          organizationId: record.organizationId,
          matchId: record.id,
          url: attachment.url,
          note: attachment.name ? `Warning evidence: ${attachment.name}` : 'Warning evidence',
          submittedById: actor?.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        organizationId: record.organizationId,
        actorId: actor?.id,
        action: 'match.warning',
        targetType: 'warning',
        targetId: created.id,
        metadata: {
          player: input.player,
          playerDiscordId: input.playerDiscordId,
          rule: input.rule,
          note: input.note,
          attachments: input.attachments ?? [],
        },
      },
    });

    return created;
  });

  return { match: await getMatch(matchCode), warning };
}

export async function addEvidence(matchCode, input) {
  const record = await getMatchRecord(matchCode);

  if (!record) {
    return null;
  }

  const submitter = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const evidence = await prisma.evidence.create({
    data: {
      organizationId: record.organizationId,
      matchId: record.id,
      url: input.url,
      note: input.note,
      submittedById: submitter?.id,
    },
  });

  return { match: await getMatch(matchCode), evidence };
}

export async function reviewEvidence(evidenceId, input) {
  const existing = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    include: { match: true },
  });

  if (!existing) {
    return null;
  }

  if (input.matchCode && existing.match.publicCode !== input.matchCode.toUpperCase()) {
    return null;
  }

  if (input.organizationId && existing.organizationId !== input.organizationId) {
    return null;
  }

  const reviewer = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const evidence = await prisma.evidence.update({
    where: { id: evidenceId },
    data: {
      status: input.status,
      reviewedById: reviewer?.discordUserId ?? null,
      reviewedAt: new Date(),
      reviewNote: input.note ?? null,
    },
    include: {
      match: {
        include: matchInclude,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: evidence.organizationId,
      actorId: reviewer?.id,
      action: `evidence.${input.status}`,
      targetType: 'evidence',
      targetId: evidence.id,
      metadata: { note: input.note },
    },
  });

  return { evidence, match: toMatchView(evidence.match) };
}

export async function logMatchNote(matchCode, input) {
  const record = await getMatchRecord(matchCode);

  if (!record) {
    return null;
  }

  const actor = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const auditLog = await prisma.$transaction(async (tx) => {
    const created = await tx.auditLog.create({
      data: {
        organizationId: record.organizationId,
        actorId: actor?.id,
        action: `match.log.${input.kind}`,
        targetType: 'match',
        targetId: record.id,
        metadata: {
          summary: input.summary,
          details: input.details,
          playerDiscordId: input.playerDiscordId,
          attachments: input.attachments ?? [],
        },
      },
    });

    for (const attachment of input.attachments ?? []) {
      await tx.evidence.create({
        data: {
          organizationId: record.organizationId,
          matchId: record.id,
          url: attachment.url,
          note: input.summary ? `${input.summary}: ${attachment.name ?? attachment.url}` : attachment.name,
          submittedById: actor?.id,
        },
      });
    }

    return created;
  });

  return { match: await getMatch(matchCode), auditLog };
}

export async function setMatchDisputed(matchCode, input) {
  const record = await getMatchRecord(matchCode);

  if (!record) {
    return null;
  }

  const actor = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        organizationId: record.organizationId,
        actorId: actor?.id,
        action: 'match.dispute',
        targetType: 'match',
        targetId: record.id,
        metadata: { reason: input.reason },
      },
    });

    return tx.match.update({
      where: { id: record.id },
      data: { status: toDbStatus(MatchStatus.Disputed), disputeReason: input.reason ?? null },
      include: matchInclude,
    });
  });

  return toMatchView(updated);
}

export async function setMatchReferee(matchCode, discordUserId, actorUser) {
  const record = await getMatchRecord(matchCode);

  if (!record) {
    return null;
  }

  const actor = actorUser ? await ensureUserProfile(actorUser) : null;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        organizationId: record.organizationId,
        actorId: actor?.id,
        action: 'match.referee',
        targetType: 'match',
        targetId: record.id,
        metadata: { assignedRefereeId: discordUserId ?? null },
      },
    });

    return tx.match.update({
      where: { id: record.id },
      data: { assignedRefereeId: discordUserId ?? null },
      include: matchInclude,
    });
  });

  return toMatchView(updated);
}

export async function getMatchTimeline(matchCode) {
  const record = await prisma.match.findUnique({
    where: { publicCode: matchCode.toUpperCase() },
    select: { id: true, publicCode: true, teamAName: true, teamBName: true },
  });

  if (!record) {
    return null;
  }

  const [audits, pauses, warnings, evidence, vetoActions, scoreReports, rosters] = await Promise.all([
    prisma.auditLog.findMany({ where: { targetType: 'match', targetId: record.id }, include: { actor: true } }),
    prisma.pauseLog.findMany({ where: { matchId: record.id }, include: { actor: true } }),
    prisma.warning.findMany({ where: { matchId: record.id }, include: { actor: true } }),
    prisma.evidence.findMany({ where: { matchId: record.id }, include: { submittedBy: true } }),
    prisma.vetoAction.findMany({ where: { matchId: record.id } }),
    prisma.scoreReport.findMany({ where: { matchId: record.id } }),
    prisma.rosterSubmission.findMany({ where: { matchId: record.id } }),
  ]);

  const events = [];

  for (const entry of audits) {
    events.push({ at: entry.createdAt, actor: entry.actor?.discordUserId, text: describeAuditEvent(entry) });
  }
  for (const pause of pauses) {
    events.push({
      at: pause.createdAt,
      actor: pause.actor?.discordUserId,
      text: `⏸️ Pause (${pause.pauseType}) ${pause.durationMinutes}m${pause.teamName ? ` — ${pause.teamName}` : ''}${pause.reason ? ` — ${pause.reason}` : ''}`,
    });
  }
  for (const warning of warnings) {
    events.push({ at: warning.createdAt, actor: warning.actor?.discordUserId, text: `⚠️ Warning: ${warning.player} — ${warning.rule}` });
  }
  for (const item of evidence) {
    events.push({ at: item.createdAt, actor: item.submittedBy?.discordUserId, text: `📎 Evidence: ${item.note || item.url}` });
  }
  for (const veto of vetoActions) {
    events.push({ at: veto.createdAt, text: `🗺️ ${veto.teamSlot} ${veto.kind.toLowerCase()} ${veto.mapName}` });
  }

  for (const report of scoreReports) {
    events.push({ at: report.createdAt, actor: report.submittedById, text: `Score report (${report.status}): ${report.teamAScore}-${report.teamBScore} (${report.scoringType})` });
  }
  for (const roster of rosters) {
    events.push({ at: roster.createdAt, actor: roster.submittedById, text: `Roster ${roster.status}: ${roster.teamName}` });
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return { match: { id: record.publicCode, teamA: record.teamAName, teamB: record.teamBName }, events };
}

function describeAuditEvent(entry) {
  const metadata = entry.metadata ?? {};

  if (entry.action === 'match.create') {
    return '🆕 Match created';
  }
  if (entry.action === 'match.score') {
    return `📊 Score ${metadata.teamAScore}-${metadata.teamBScore} (${metadata.scoringType ?? 'match'})${metadata.comment ? ` — ${metadata.comment}` : ''}`;
  }
  if (entry.action.startsWith('match.ruling.')) {
    return `⚖️ Ruling: ${entry.action.replace('match.ruling.', '')}${metadata.affectedTeam ? ` — ${metadata.affectedTeam}` : ''}${metadata.reason ? ` (${metadata.reason})` : ''}`;
  }
  if (entry.action.startsWith('match.log.')) {
    return `📝 Log (${entry.action.replace('match.log.', '')}): ${metadata.summary ?? ''}`;
  }
  if (entry.action === 'match.dispute') {
    return `🚨 Dispute raised${metadata.reason ? `: ${metadata.reason}` : ''}`;
  }
  if (entry.action === 'match.referee') {
    return metadata.assignedRefereeId ? `🙋 Referee claimed by <@${metadata.assignedRefereeId}>` : '🙋 Referee unassigned';
  }

  return entry.action;
}

export async function closeMatch(matchCode) {
  const match = await prisma.match.update({
    where: { publicCode: matchCode.toUpperCase() },
    data: { status: toDbStatus(MatchStatus.Complete) },
    include: matchInclude,
  });

  return toMatchView(match);
}
