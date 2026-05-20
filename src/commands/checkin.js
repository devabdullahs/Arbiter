import { SlashCommandBuilder } from 'discord.js';
import { getMatch } from '../services/match-service.js';
import { recordCheckin } from '../services/checkin-service.js';
import { playerCompanion } from './install-contexts.js';

export const checkinCommand = {
  data: playerCompanion(
    new SlashCommandBuilder()
      .setName('checkin')
      .setDescription('Check into a match with your linked game account.')
      .addStringOption((option) =>
        option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12),
      )
      .addStringOption((option) =>
        option
          .setName('game_account')
          .setDescription('Riot ID, Steam profile, FACEIT, Battlefy, etc.')
          .setRequired(true)
          .setMaxLength(120),
      ),
  ),

  async execute(interaction) {
    const matchId = interaction.options.getString('match_id', true).toUpperCase();
    const match = await getMatch(matchId);

    if (!match) {
      await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
      return;
    }

    const checkin = await recordCheckin({
      matchCode: matchId,
      user: interaction.user,
      gameAccount: interaction.options.getString('game_account', true),
    });

    const verdict = checkin.validation.ok ? 'Check-in recorded.' : `Check-in flagged: ${checkin.validation.reason}`;
    await interaction.reply({ content: verdict, ephemeral: true });
  },
};
