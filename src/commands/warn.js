import { SlashCommandBuilder } from 'discord.js';
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
      ),
  ),

  async execute(interaction) {
    const context = await requireManagedMatch(interaction, interaction.options.getString('match_id', true));

    if (!context) {
      return;
    }

    const player = interaction.options.getUser('player', true);
    await interaction.showModal(warnIssueModal(context.match, player.id, interaction.options.getBoolean('notify_player') ?? false));
  },
};
