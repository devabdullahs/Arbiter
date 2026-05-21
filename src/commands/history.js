import { SlashCommandBuilder } from 'discord.js';
import { getPlayerHistory, getTeamHistory } from '../services/history-service.js';
import { isOrgRefereeOrAdmin, requireOrganization } from '../services/org-service.js';
import { guildOnly } from './install-contexts.js';

export const historyCommand = {
  data: guildOnly(
    new SlashCommandBuilder()
      .setName('history')
      .setDescription('Look up match history by team or player.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('team')
          .setDescription('Show recent matches and operational history for a team.')
          .addStringOption((option) => option.setName('name').setDescription('Team name').setRequired(true).setMaxLength(120)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('player')
          .setDescription('Show warnings and roster appearances for a player.')
          .addStringOption((option) => option.setName('player').setDescription('Player name, mention, or Discord id').setRequired(true).setMaxLength(120)),
      ),
  ),

  async execute(interaction) {
    const organization = await requireOrganization(interaction);

    if (!(await isOrgRefereeOrAdmin(interaction, organization))) {
      await interaction.reply({ content: 'Only an org admin or referee can view operational history.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'team') {
      const teamName = interaction.options.getString('name', true);
      const history = await getTeamHistory(organization.id, teamName);
      await interaction.reply({ content: formatTeamHistory(teamName, history), ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }

    const player = interaction.options.getString('player', true);
    const history = await getPlayerHistory(organization.id, player.replace(/[<@!>]/g, ''));
    await interaction.reply({ content: formatPlayerHistory(player, history), ephemeral: true, allowedMentions: { parse: [] } });
  },
};

function formatTeamHistory(teamName, history) {
  if (history.length === 0) {
    return `No match history found for **${teamName}**.`;
  }

  const lines = history.map(
    (item) =>
      `\`${item.matchCode}\` ${item.teams} - ${item.status} ${item.score} | warnings ${item.warnings}, pauses ${item.pauses}, evidence ${item.evidence}`,
  );

  return [`## Team History - ${teamName}`, ...lines].join('\n').slice(0, 1900);
}

function formatPlayerHistory(player, history) {
  const warningLines = history.warnings.length
    ? history.warnings.map((warning) => `- \`${warning.matchCode}\` ${warning.rule} (${warning.teams}) <t:${Math.floor(warning.createdAt.getTime() / 1000)}:d>`).join('\n')
    : 'No warnings found.';
  const rosterLines = history.rosters.length
    ? history.rosters.map((roster) => `- \`${roster.match.publicCode}\` ${roster.teamName} roster (${roster.status})`).join('\n')
    : 'No exact roster entries found.';

  return [`## Player History - ${player}`, '**Warnings**', warningLines, '', '**Rosters**', rosterLines].join('\n').slice(0, 1900);
}
