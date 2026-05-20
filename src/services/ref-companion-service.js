import { prisma } from '../db/prisma.js';
import { getMatch } from './match-service.js';
import { hasOrgRefereeOrAdminAccess, isOrgRefereeOrAdmin, listRefereeOrganizationsForUser } from './org-service.js';

const ACTIVE_STATUSES = ['PENDING', 'VETO', 'LIVE', 'DISPUTED'];

export async function canUseRefCompanion(interaction, match) {
  if (match.assignedRefereeId === interaction.user.id) {
    return true;
  }

  if (interaction.guildId && interaction.guildId === match.guildId) {
    return isOrgRefereeOrAdmin(interaction, { id: match.organizationId, settings: match.settings });
  }

  return hasOrgRefereeOrAdminAccess(match.organizationId, interaction.user.id);
}

export async function requireRefCompanionMatch(interaction, matchCode) {
  const match = await getMatch(matchCode);

  if (!match) {
    await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
    return null;
  }

  if (!(await canUseRefCompanion(interaction, match))) {
    await interaction.reply({
      content:
        'You are not authorized for this match from this context. Outside the org guild, you must be the assigned referee or have an org admin/referee DB membership.',
      ephemeral: true,
    });
    return null;
  }

  return match;
}

export async function getRefCompanionDashboard(discordUserId) {
  const organizations = await listRefereeOrganizationsForUser(discordUserId);
  const orgIds = organizations.map((org) => org.id);

  const [assignedMatches, orgMatches, pendingScores, openEvidence, rosterReviews, reminders] = await Promise.all([
    prisma.match.findMany({
      where: { assignedRefereeId: discordUserId, status: { in: ACTIVE_STATUSES } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    orgIds.length
      ? prisma.match.findMany({
          where: { organizationId: { in: orgIds }, status: { in: ACTIVE_STATUSES } },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        })
      : [],
    orgIds.length
      ? prisma.scoreReport.findMany({
          where: { organizationId: { in: orgIds }, status: 'pending' },
          include: { match: true },
          orderBy: { createdAt: 'asc' },
          take: 10,
        })
      : [],
    orgIds.length
      ? prisma.evidence.findMany({
          where: { organizationId: { in: orgIds }, status: { in: ['submitted', 'needs_more_info'] } },
          include: { match: true },
          orderBy: { createdAt: 'asc' },
          take: 10,
        })
      : [],
    orgIds.length
      ? prisma.rosterSubmission.findMany({
          where: { organizationId: { in: orgIds }, status: 'submitted' },
          include: { match: true },
          orderBy: { updatedAt: 'asc' },
          take: 10,
        })
      : [],
    orgIds.length
      ? prisma.scheduledReminder.findMany({
          where: { organizationId: { in: orgIds }, deliveredAt: null },
          include: { match: true },
          orderBy: { dueAt: 'asc' },
          take: 10,
        })
      : [],
  ]);

  return { organizations, assignedMatches, orgMatches, pendingScores, openEvidence, rosterReviews, reminders };
}
