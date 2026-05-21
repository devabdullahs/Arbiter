import { prisma } from '../db/prisma.js';
import { getMatch } from './match-service.js';

const DEFAULT_TEAM_PAUSE_BUDGET_MINUTES = 10;

export async function getPauseLedger(matchCode, options = {}) {
  const match = await getMatch(matchCode);

  if (!match) {
    return null;
  }

  const budgetMinutes = Number.isFinite(options.budgetMinutes)
    ? options.budgetMinutes
    : DEFAULT_TEAM_PAUSE_BUDGET_MINUTES;
  const pauses = await prisma.pauseLog.findMany({
    where: { matchId: match.dbId },
    include: { actor: true },
    orderBy: { createdAt: 'asc' },
  });

  const teams = [match.teamA, match.teamB].map((team) => {
    const entries = pauses.filter((pause) => isTeamPauseFor(pause, team));
    const usedMinutes = entries.reduce((sum, pause) => sum + pause.durationMinutes, 0);

    return {
      team,
      budgetMinutes,
      usedMinutes,
      remainingMinutes: Math.max(0, budgetMinutes - usedMinutes),
      entries,
    };
  });

  const otherPauses = pauses.filter((pause) => !teams.some((team) => team.entries.some((entry) => entry.id === pause.id)));

  return { match, teams, otherPauses, pauses };
}

function isTeamPauseFor(pause, teamName) {
  if (pause.pauseType !== 'team') {
    return false;
  }

  if (!pause.teamName) {
    return false;
  }

  return normalize(pause.teamName) === normalize(teamName);
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
