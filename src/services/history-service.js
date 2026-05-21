import { prisma } from '../db/prisma.js';
import { getInfractionHistory } from './infraction-service.js';

export async function getTeamHistory(organizationId, teamName) {
  const matches = await prisma.match.findMany({
    where: {
      organizationId,
      OR: [
        { teamAName: { contains: teamName, mode: 'insensitive' } },
        { teamBName: { contains: teamName, mode: 'insensitive' } },
      ],
    },
    include: {
      warnings: true,
      pauseLogs: true,
      evidence: true,
      scoreReports: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 15,
  });

  return matches.map((match) => ({
    matchCode: match.publicCode,
    teams: `${match.teamAName} vs ${match.teamBName}`,
    status: match.status,
    score: `${match.teamAScore}-${match.teamBScore}`,
    warnings: match.warnings.length,
    pauses: match.pauseLogs.length,
    evidence: match.evidence.length,
    scoreReports: match.scoreReports.length,
    updatedAt: match.updatedAt,
  }));
}

export async function getPlayerHistory(organizationId, playerQuery) {
  const warnings = await getInfractionHistory(organizationId, playerQuery);
  const rosters = await prisma.rosterSubmission.findMany({
    where: {
      organizationId,
      players: { array_contains: [playerQuery] },
    },
    include: { match: true },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  }).catch(() => []);

  return { warnings, rosters };
}
