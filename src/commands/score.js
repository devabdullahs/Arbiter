import { SlashCommandBuilder } from 'discord.js';
import { listPendingScoreReports, reviewScoreReport } from '../services/score-report-service.js';
import { updateMatchMessages } from '../utils/match-message-updater.js';
import { scoreReportModal } from '../ui/modals.js';
import { guildOnly } from './install-contexts.js';
import { requireManagedMatch } from './command-auth.js';
import { isOrgRefereeOrAdmin, requireOrganization } from '../services/org-service.js';

export const scoreCommand = {
  data: guildOnly(
    new SlashCommandBuilder()
      .setName('score')
      .setDescription('Referee score reporting workflows.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('report')
          .setDescription('Report a final score with screenshot proof.')
          .addStringOption((option) =>
            option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12),
          )
          .addUserOption((option) =>
            option.setName('player').setDescription('Optional player/captain to notify').setRequired(false),
          )
          .addBooleanOption((option) =>
            option.setName('notify_player').setDescription('Send the score reference to the selected player'),
          )
          .addStringOption((option) =>
            option
              .setName('scoring_type')
              .setDescription('What the submitted score represents')
              .setRequired(false)
              .addChoices(
                { name: 'Whole match', value: 'match' },
                { name: 'Map/game', value: 'map' },
                { name: 'Round', value: 'round' },
                { name: 'Set', value: 'set' },
                { name: 'Custom', value: 'custom' },
              ),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('pending')
          .setDescription('List pending player score reports.')
          .addStringOption((option) => option.setName('match_id').setDescription('Optional public match code').setRequired(false).setMaxLength(12)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('review')
          .setDescription('Approve, reject, or request more evidence for a pending score report.')
          .addStringOption((option) => option.setName('report_id').setDescription('Pending score report id').setRequired(true).setMaxLength(40))
          .addStringOption((option) =>
            option
              .setName('decision')
              .setDescription('Review decision')
              .setRequired(true)
              .addChoices(
                { name: 'Approve', value: 'approve' },
                { name: 'Reject', value: 'reject' },
                { name: 'Needs more evidence', value: 'needs_more_info' },
              ),
          )
          .addStringOption((option) => option.setName('note').setDescription('Optional review note').setRequired(false).setMaxLength(500)),
      ),
  ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'pending') {
      const organization = await requireOrganization(interaction);
      if (!(await isOrgRefereeOrAdmin(interaction, organization))) {
        await interaction.reply({ content: 'Only an org admin or referee can review score reports.', ephemeral: true });
        return;
      }
      const reports = await listPendingScoreReports(organization.id, interaction.options.getString('match_id'));
      await interaction.reply({ content: formatPendingReports(reports), ephemeral: true });
      return;
    }

    if (subcommand === 'review') {
      const organization = await requireOrganization(interaction);
      if (!(await isOrgRefereeOrAdmin(interaction, organization))) {
        await interaction.reply({ content: 'Only an org admin or referee can review score reports.', ephemeral: true });
        return;
      }
      const result = await reviewScoreReport(interaction.options.getString('report_id', true), {
        organizationId: organization.id,
        decision: interaction.options.getString('decision', true),
        note: interaction.options.getString('note'),
        byUser: interaction.user,
      });

      if (!result) {
        await interaction.reply({ content: 'I could not find that score report.', ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `Score report marked ${result.report.status}${result.report.status === 'approved' ? ' and applied to the match' : ''}.`,
        ephemeral: true,
      });

      if (result.report.status === 'approved') {
        await updateMatchMessages(interaction.client, result.match);
      }
      return;
    }

    const player = interaction.options.getUser('player');
    const notifyPlayer = interaction.options.getBoolean('notify_player') ?? false;

    if (notifyPlayer && !player) {
      await interaction.reply({ content: 'Choose a player if you want to notify a player.', ephemeral: true });
      return;
    }

    const context = await requireManagedMatch(interaction, interaction.options.getString('match_id', true));

    if (!context) {
      return;
    }

    await interaction.showModal(
      scoreReportModal(
        context.match,
        player?.id ?? 'none',
        notifyPlayer,
        interaction.options.getString('scoring_type') ?? 'match',
      ),
    );
  },
};

function formatPendingReports(reports) {
  if (reports.length === 0) {
    return 'No pending score reports.';
  }

  return reports
    .map(
      (report) =>
        `\`${report.id}\` ${report.match.publicCode}: ${report.match.teamAName} ${report.teamAScore}-${report.teamBScore} ${report.match.teamBName} (${report.scoringType})${
          report.comment ? ` - ${report.comment}` : ''
        }`,
    )
    .join('\n')
    .slice(0, 1900);
}
