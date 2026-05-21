import { SlashCommandBuilder } from 'discord.js';
import { getPauseLedger } from '../services/pause-ledger-service.js';
import { guildOnly } from './install-contexts.js';
import { requireManagedMatch } from './command-auth.js';

export const pauseCommand = {
  data: guildOnly(
    new SlashCommandBuilder()
      .setName('pause')
      .setDescription('Pause budget and ledger tools.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('ledger')
          .setDescription('Show team pause budget usage for a match.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12))
          .addIntegerOption((option) =>
            option
              .setName('team_budget')
              .setDescription('Team pause budget in minutes. Defaults to 10.')
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(360),
          ),
      ),
  ),

  async execute(interaction) {
    const matchId = interaction.options.getString('match_id', true);
    const context = await requireManagedMatch(interaction, matchId);

    if (!context) {
      return;
    }

    const ledger = await getPauseLedger(context.match.id, {
      budgetMinutes: interaction.options.getInteger('team_budget') ?? undefined,
    });

    await interaction.reply({ content: formatLedger(ledger), ephemeral: true, allowedMentions: { parse: [] } });
  },
};

function formatLedger(ledger) {
  const teamLines = ledger.teams.map((team) => {
    const status = team.usedMinutes > team.budgetMinutes ? 'over budget' : `${team.remainingMinutes}m remaining`;
    const entries = team.entries.length
      ? team.entries
          .map((entry) => `  - ${entry.durationMinutes}m <t:${Math.floor(entry.createdAt.getTime() / 1000)}:t>${entry.reason ? `: ${entry.reason}` : ''}`)
          .join('\n')
      : '  - No team pauses logged.';

    return `**${team.team}**: ${team.usedMinutes}/${team.budgetMinutes}m (${status})\n${entries}`;
  });
  const otherLines = ledger.otherPauses.length
    ? ledger.otherPauses
        .map((pause) => `- ${pause.pauseType} ${pause.durationMinutes}m${pause.teamName ? ` (${pause.teamName})` : ''}: ${pause.reason}`)
        .join('\n')
    : 'No technical/admin/tactical pauses logged.';

  return [
    `## Pause Ledger - ${ledger.match.teamA} vs ${ledger.match.teamB} (\`${ledger.match.id}\`)`,
    ...teamLines,
    '',
    '**Other pauses**',
    otherLines,
  ]
    .join('\n\n')
    .slice(0, 1900);
}
