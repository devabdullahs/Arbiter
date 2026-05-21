import { SlashCommandBuilder } from 'discord.js';
import { getPlayerInfractionSummary } from '../services/infraction-service.js';
import { warnIssueModal } from '../ui/modals.js';
import { guildOnly } from './install-contexts.js';
import { requireManagedMatch } from './command-auth.js';

export const warnCommand = {
  data: guildOnly(
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Issue competitive warnings with optional evidence.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('issue')
          .setDescription('Warn a player and optionally notify them by DM.')
          .addStringOption((option) =>
            option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12),
          )
          .addUserOption((option) =>
            option.setName('player').setDescription('Player receiving the warning').setRequired(true),
          )
          .addBooleanOption((option) =>
            option.setName('notify_player').setDescription('Send this warning to the player by DM'),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('summary')
          .setDescription('Show a player warning count and infraction history for this org.')
          .addStringOption((option) =>
            option.setName('match_id').setDescription('Any public match code in this org').setRequired(true).setMaxLength(12),
          )
          .addStringOption((option) =>
            option.setName('player').setDescription('Player name, mention, or Discord id').setRequired(true).setMaxLength(120),
          ),
      ),
  ),

  async execute(interaction) {
    const context = await requireManagedMatch(interaction, interaction.options.getString('match_id', true));

    if (!context) {
      return;
    }

    if (interaction.options.getSubcommand() === 'summary') {
      const player = interaction.options.getString('player', true);
      const summary = await getPlayerInfractionSummary(context.organization.id, {
        player,
        playerDiscordId: player.replace(/[<@!>]/g, ''),
      });
      await interaction.reply({ content: formatSummary(summary), ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }

    const player = interaction.options.getUser('player', true);
    await interaction.showModal(warnIssueModal(context.match, player.id, interaction.options.getBoolean('notify_player') ?? false));
  },
};

function formatSummary(summary) {
  const warnings = summary.warnings.length
    ? summary.warnings
        .slice(0, 10)
        .map((warning) => `- \`${warning.match.publicCode}\` ${warning.rule} <t:${Math.floor(warning.createdAt.getTime() / 1000)}:d>${warning.note ? `: ${warning.note}` : ''}`)
        .join('\n')
    : 'No warnings found.';

  return [
    `## Infraction Summary - ${summary.player}`,
    `Warnings: ${summary.warningCount}/${summary.threshold}${summary.thresholdReached ? ' - admin review recommended' : ''}`,
    '',
    warnings,
  ].join('\n').slice(0, 1900);
}
