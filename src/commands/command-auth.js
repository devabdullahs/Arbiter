import { getMatch } from '../services/match-service.js';
import { isOrgRefereeOrAdmin, requireOrganization } from '../services/org-service.js';

export async function requireManagedMatch(interaction, matchCode) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command is only available inside an org server.', ephemeral: true });
    return null;
  }

  const organization = await requireOrganization(interaction);
  const match = await getMatch(matchCode);

  if (!match || match.organizationId !== organization.id) {
    await interaction.reply({ content: 'I could not find that match in this org.', ephemeral: true });
    return null;
  }

  if (!(await isOrgRefereeOrAdmin(interaction, organization))) {
    await interaction.reply({ content: 'Only an org admin or referee can use this command.', ephemeral: true });
    return null;
  }

  return { organization, match };
}
