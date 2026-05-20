import { prisma } from '../db/prisma.js';
import { ensureUserProfile } from './profile-service.js';
import { getMatch, getMatchRecord, logScore } from './match-service.js';

export async function createPendingScoreReport(matchCode, input) {
  const match = await getMatchRecord(matchCode);

  if (!match) {
    return null;
  }

  const submitter = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const report = await prisma.scoreReport.create({
    data: {
      organizationId: match.organizationId,
      matchId: match.id,
      teamAScore: Number(input.teamAScore),
      teamBScore: Number(input.teamBScore),
      scoringType: input.scoringType ?? 'match',
      comment: input.comment ?? null,
      attachments: input.attachments ?? [],
      submittedById: submitter?.discordUserId ?? null,
    },
    include: { match: true },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: match.organizationId,
      actorId: submitter?.id,
      action: 'score.pending',
      targetType: 'scoreReport',
      targetId: report.id,
      metadata: {
        publicCode: match.publicCode,
        teamAScore: report.teamAScore,
        teamBScore: report.teamBScore,
        scoringType: report.scoringType,
      },
    },
  });

  return { report, match: await getMatch(match.publicCode) };
}

export async function listPendingScoreReports(organizationId, matchCode) {
  const where = { organizationId, status: 'pending' };

  if (matchCode) {
    const match = await getMatchRecord(matchCode);
    if (!match || match.organizationId !== organizationId) return [];
    where.matchId = match.id;
  }

  return prisma.scoreReport.findMany({
    where,
    include: { match: true },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
}

export async function getScoreReport(reportId) {
  return prisma.scoreReport.findUnique({
    where: { id: reportId },
    include: {
      match: {
        include: {
          organization: { include: { settings: true } },
          vetoActions: { orderBy: { createdAt: 'asc' } },
          room: true,
        },
      },
    },
  });
}

export async function reviewScoreReport(reportId, input) {
  const report = await getScoreReport(reportId);

  if (!report) {
    return null;
  }

  if (input.organizationId && report.organizationId !== input.organizationId) {
    return null;
  }

  const reviewer = input.byUser ? await ensureUserProfile(input.byUser) : null;
  const decision = input.decision;
  let updatedMatch = await getMatch(report.match.publicCode);

  if (decision === 'approve') {
    updatedMatch = await logScore(report.match.publicCode, {
      teamAScore: report.teamAScore,
      teamBScore: report.teamBScore,
      scoringType: report.scoringType,
      comment: report.comment,
      attachments: Array.isArray(report.attachments) ? report.attachments : [],
      byUser: input.byUser,
    });
  }

  const status = decision === 'approve' ? 'approved' : decision === 'needs_more_info' ? 'needs_more_info' : 'rejected';
  const updated = await prisma.scoreReport.update({
    where: { id: report.id },
    data: {
      status,
      reviewedById: reviewer?.discordUserId ?? null,
      reviewedAt: new Date(),
      reviewNote: input.note ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: report.organizationId,
      actorId: reviewer?.id,
      action: `score.${status}`,
      targetType: 'scoreReport',
      targetId: report.id,
      metadata: {
        publicCode: report.match.publicCode,
        note: input.note,
      },
    },
  });

  return { report: updated, match: updatedMatch };
}
