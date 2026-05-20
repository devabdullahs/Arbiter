import { SlashCommandBuilder } from 'discord.js';
import { getRefDashboard } from '../services/dashboard-service.js';
import { getMatch, setMatchReferee } from '../services/match-service.js';
import { isOrgRefereeOrAdmin, requireOrganization } from '../services/org-service.js';
import { guildOnly } from './install-contexts.js';

export const refCommand = {
  data: guildOnly(
    new SlashCommandBuilder()
      .setName('ref')
      .setDescription('Referee operations dashboard and assignment tools.')
      .addSubcommand((subcommand) => subcommand.setName('dashboard').setDescription('Show matches and referee work needing attention.'))
      .addSubcommand((subcommand) =>
        subcommand
          .setName('assign')
          .setDescription('Assign a referee to a match.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12))
          .addUserOption((option) => option.setName('referee').setDescription('Referee to assign').setRequired(true)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('unassign')
          .setDescription('Clear the assigned referee for a match.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12)),
      ),
  ),

  async execute(interaction) {
    const organization = await requireOrganization(interaction);

    if (!(await isOrgRefereeOrAdmin(interaction, organization))) {
      await interaction.reply({ content: 'Only an org admin or referee can use ref tools.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'dashboard') {
      const dashboard = await getRefDashboard(organization.id);
      await interaction.reply({ content: formatDashboard(dashboard), ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }

    const match = await getMatch(interaction.options.getString('match_id', true));

    if (!match || match.organizationId !== organization.id) {
      await interaction.reply({ content: 'I could not find that match in this org.', ephemeral: true });
      return;
    }

    const referee = subcommand === 'assign' ? interaction.options.getUser('referee', true) : null;
    const updated = await setMatchReferee(match.id, referee?.id ?? null, interaction.user);

    await interaction.reply({
      content: referee ? `Assigned <@${referee.id}> to \`${updated.id}\`.` : `Cleared referee assignment for \`${updated.id}\`.`,
      ephemeral: true,
      allowedMentions: { users: referee ? [referee.id] : [] },
    });
  },
};

function formatDashboard(dashboard) {
  const active = dashboard.activeMatches.length
    ? dashboard.activeMatches
        .map((match) => `\`${match.publicCode}\` ${match.teamAName} vs ${match.teamBName} - ${match.status}${match.assignedRefereeId ? ` - ref <@${match.assignedRefereeId}>` : ' - unassigned'}`)
        .join('\n')
    : 'No active matches.';
  const scores = dashboard.pendingScores.length
    ? dashboard.pendingScores
        .map((report) => `\`${report.id}\` ${report.match.publicCode}: ${report.teamAScore}-${report.teamBScore} (${report.scoringType})`)
        .join('\n')
    : 'No pending score reports.';
  const rosters = dashboard.submittedRosters.length
    ? dashboard.submittedRosters.map((roster) => `\`${roster.match.publicCode}\` ${roster.teamName} roster awaiting review`).join('\n')
    : 'No rosters awaiting review.';
  const evidence = dashboard.openEvidence.length
    ? dashboard.openEvidence.map((item) => `\`${item.id}\` ${item.match.publicCode}: ${item.status} - ${item.note ?? item.url}`).join('\n')
    : 'No open evidence.';
  const reminders = dashboard.activeReminders.length
    ? dashboard.activeReminders
        .map((reminder) => `\`${reminder.match?.publicCode ?? 'org'}\` ${reminder.kind} due <t:${Math.floor(reminder.dueAt.getTime() / 1000)}:R>`)
        .join('\n')
    : 'No active reminders.';

  return [
    '## Referee Dashboard',
    '**Active Matches**',
    active,
    '',
    '**Pending Scores**',
    scores,
    '',
    '**Roster Review**',
    rosters,
    '',
    '**Evidence Review**',
    evidence,
    '',
    '**Reminders**',
    reminders,
  ]
    .join('\n')
    .slice(0, 1900);
}
