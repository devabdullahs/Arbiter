import { SlashCommandBuilder } from 'discord.js';
import { setRefereeShift } from '../services/referee-service.js';
import { requireOrganization } from '../services/org-service.js';
import { guildOnly } from './install-contexts.js';

export const refShiftCommand = {
  data: guildOnly(
    new SlashCommandBuilder()
      .setName('ref-shift')
      .setDescription('Mark yourself available or unavailable for referee pages.')
      .addBooleanOption((option) =>
        option.setName('on_shift').setDescription('Whether you are available for referee pages').setRequired(true),
      ),
  ),

  async execute(interaction) {
    const organization = await requireOrganization(interaction);
    const onShift = interaction.options.getBoolean('on_shift', true);
    await setRefereeShift(organization.id, interaction.user, onShift);
    await interaction.reply({
      content: onShift ? 'You are now on shift for referee pages.' : 'You are now off shift.',
      ephemeral: true,
    });
  },
};
