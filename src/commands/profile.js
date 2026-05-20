import { SlashCommandBuilder } from 'discord.js';
import { getUserProfile, linkAccount } from '../services/profile-service.js';
import { playerCompanion } from './install-contexts.js';

export const profileCommand = {
  data: playerCompanion(
    new SlashCommandBuilder()
      .setName('profile')
      .setDescription('Manage your esports player profile.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('link')
          .setDescription('Link a game account to your Discord profile.')
          .addStringOption((option) =>
            option
              .setName('provider')
              .setDescription('Account provider')
              .setRequired(true)
              .addChoices(
                { name: 'Riot', value: 'riot' },
                { name: 'Steam', value: 'steam' },
                { name: 'FACEIT', value: 'faceit' },
                { name: 'Other', value: 'other' },
              ),
          )
          .addStringOption((option) =>
            option.setName('handle').setDescription('Account handle or profile URL').setRequired(true).setMaxLength(160),
          ),
      )
      .addSubcommand((subcommand) => subcommand.setName('view').setDescription('View your linked accounts.')),
  ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'link') {
      const account = await linkAccount(interaction.user, {
        provider: interaction.options.getString('provider', true),
        handle: interaction.options.getString('handle', true),
      });

      await interaction.reply({
        content: `Linked ${account.provider}: ${account.handle}`,
        ephemeral: true,
      });
      return;
    }

    const profile = await getUserProfile(interaction.user.id);
    const accounts = profile?.linkedAccounts?.length
      ? profile.linkedAccounts.map((account) => `- ${account.provider}: ${account.handle}`).join('\n')
      : 'No linked accounts yet. Use /profile link to add one.';

    await interaction.reply({ content: accounts, ephemeral: true });
  },
};
