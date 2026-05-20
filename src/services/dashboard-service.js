import { prisma } from '../db/prisma.js';

export async function getRefDashboard(organizationId) {
  const [activeMatches, pendingScores, submittedRosters, openEvidence, activeReminders] = await Promise.all([
    prisma.match.findMany({
      where: { organizationId, status: { in: ['PENDING', 'VETO', 'LIVE', 'DISPUTED'] } },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    }),
    prisma.scoreReport.findMany({
      where: { organizationId, status: 'pending' },
      include: { match: true },
      orderBy: { createdAt: 'asc' },
      take: 10,
    }),
    prisma.rosterSubmission.findMany({
      where: { organizationId, status: 'submitted' },
      include: { match: true },
      orderBy: { updatedAt: 'asc' },
      take: 10,
    }),
    prisma.evidence.findMany({
      where: { organizationId, status: { in: ['submitted', 'needs_more_info'] } },
      include: { match: true },
      orderBy: { createdAt: 'asc' },
      take: 10,
    }),
    prisma.scheduledReminder.findMany({
      where: { organizationId, deliveredAt: null },
      include: { match: true },
      orderBy: { dueAt: 'asc' },
      take: 10,
    }),
  ]);

  return { activeMatches, pendingScores, submittedRosters, openEvidence, activeReminders };
}
