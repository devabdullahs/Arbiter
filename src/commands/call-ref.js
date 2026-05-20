import { SlashCommandBuilder } from 'discord.js';
import { getMatch } from '../services/match-service.js';
import { dmRefereeRequest, getRefereeRequestTargets } from '../services/referee-notification-service.js';
import { playerCompanion } from './install-contexts.js';

export const callRefCommand = {
  data: playerCompanion(
    new SlashCommandBuilder()
      .setName('call-ref')
      .setDescription('Request an on-shift referee for a match.')
      .addStringOption((option) =>
        option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12),
      ),
  ),

  async execute(interaction) {
    const match = await getMatch(interaction.options.getString('match_id', true));

    if (!match) {
      await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
      return;
    }

    const targetIds = await getRefereeRequestTargets(match);
    const mentions = targetIds.map((id) => `<@${id}>`);
    const roleId = match.settings?.refereeRoleId;

    if (roleId && interaction.guildId === match.guildId && !match.assignedRefereeId) {
      mentions.push(`<@&${roleId}>`);
    }

    if (mentions.length === 0) {
      await interaction.reply({ content: 'No on-shift referees are registered right now.', ephemeral: true });
      return;
    }

    if (interaction.guildId !== match.guildId) {
      const sent = await dmRefereeRequest(interaction.client, match, interaction.user, targetIds);
      await interaction.reply({
        content:
          sent > 0
            ? `Referee request sent for \`${match.id}\` to ${sent} referee(s).`
            : 'I found referee targets, but could not DM them. Ask an admin to install the bot in the org server or have refs enable DMs.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `${mentions.join(' ')} referee requested for \`${match.id}\` (${match.teamA} vs ${match.teamB}).`,
      allowedMentions: { users: targetIds, roles: roleId && interaction.guildId === match.guildId && !match.assignedRefereeId ? [roleId] : [] },
      ephemeral: !interaction.guildId,
    });
  },
};
