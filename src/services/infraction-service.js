import { prisma } from '../db/prisma.js';

const DEFAULT_WARNING_THRESHOLD = 2;

export function warningThreshold() {
  const parsed = Number(process.env.WARNING_THRESHOLD ?? DEFAULT_WARNING_THRESHOLD);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_WARNING_THRESHOLD;
}

export async function getPlayerInfractionSummary(organizationId, input) {
  const threshold = warningThreshold();
  const warnings = await findPlayerWarnings(organizationId, input);
  const count = warnings.length;

  return {
    player: input.player,
    playerDiscordId: input.playerDiscordId ?? null,
    warningCount: count,
    threshold,
    thresholdReached: count >= threshold,
    shouldEscalate: count >= threshold && count % threshold === 0,
    warnings,
  };
}

export async function getInfractionHistory(organizationId, query) {
  const warnings = await findPlayerWarnings(organizationId, { player: query, playerDiscordId: query });

  return warnings.map((warning) => ({
    id: warning.id,
    player: warning.player,
    rule: warning.rule,
    note: warning.note,
    matchCode: warning.match.publicCode,
    teams: `${warning.match.teamAName} vs ${warning.match.teamBName}`,
    createdAt: warning.createdAt,
    actorId: warning.actor?.discordUserId ?? null,
  }));
}

async function findPlayerWarnings(organizationId, input) {
  const needles = [...new Set([input.playerDiscordId, input.player, stripMention(input.player)].filter(Boolean))];

  if (needles.length === 0) {
    return [];
  }

  return prisma.warning.findMany({
    where: {
      organizationId,
      OR: needles.map((needle) => ({ player: { contains: needle, mode: 'insensitive' } })),
    },
    include: { match: true, actor: true },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
}

function stripMention(value) {
  return value?.replace(/[<@!>]/g, '') ?? null;
}
