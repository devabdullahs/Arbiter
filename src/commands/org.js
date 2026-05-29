import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getOrgMemberRole, isOrgAdmin, listOrgMembers, resolveOrganizationByGuild, setOrgMemberRole, setupOrganization } from '../services/org-service.js';
import { guildOnly } from './install-contexts.js';

export const orgCommand = {
  data: guildOnly(
    new SlashCommandBuilder()
      .setName('org')
      .setDescription('Configure this Discord server as an esports organization.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('setup')
          .setDescription('Configure roles and channels for this organization.')
          .addRoleOption((option) =>
            option.setName('admin_role').setDescription('Role allowed to manage tournaments').setRequired(false),
          )
          .addRoleOption((option) =>
            option.setName('referee_role').setDescription('Role allowed to referee matches').setRequired(false),
          )
          .addBooleanOption((option) =>
            option
              .setName('auto_create')
              .setDescription('Automatically create missing esports category/log/evidence channels')
              .setRequired(false),
          )
          .addChannelOption((option) =>
            option
              .setName('match_category')
              .setDescription('Category where temporary match rooms are created')
              .addChannelTypes(ChannelType.GuildCategory)
              .setRequired(false),
          )
          .addChannelOption((option) =>
            option
              .setName('match_log_channel')
              .setDescription('Channel for score/admin audit messages')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false),
          )
          .addChannelOption((option) =>
            option
              .setName('evidence_channel')
              .setDescription('Channel for future evidence mirroring notifications')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('member')
          .setDescription('Save an org admin/referee/player membership for off-guild workflows.')
          .addUserOption((option) => option.setName('user').setDescription('Discord user').setRequired(true))
          .addStringOption((option) =>
            option
              .setName('role')
              .setDescription('Saved org role')
              .setRequired(true)
              .addChoices(
                { name: 'Owner', value: 'OWNER' },
                { name: 'Admin', value: 'ADMIN' },
                { name: 'Manager', value: 'MANAGER' },
                { name: 'Head Referee', value: 'HEAD_REF' },
                { name: 'Referee', value: 'REFEREE' },
                { name: 'Player', value: 'PLAYER' },
              ),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('members').setDescription('List saved org admins and referees for user-installed workflows.'),
      ),
  ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const existing = await resolveOrganizationByGuild(interaction.guild);
    const canManageServer =
      interaction.member?.permissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);

    if (subcommand === 'member' || subcommand === 'members') {
      if (!existing) {
        await interaction.reply({ content: 'This server is not configured yet. Run /org setup first.', ephemeral: true });
        return;
      }

      if (!(await isOrgAdmin(interaction, existing))) {
        await interaction.reply({ content: 'Only an org admin can manage saved org members.', ephemeral: true });
        return;
      }

      if (subcommand === 'members') {
        const members = await listOrgMembers(existing.id);
        await interaction.reply({ content: formatMembers(members), ephemeral: true, allowedMentions: { parse: [] } });
        return;
      }

      const user = interaction.options.getUser('user', true);
      const role = interaction.options.getString('role', true);

      // Least privilege: granting OWNER/ADMIN can escalate above the actor's own
      // level, so restrict it to org owners or Discord server admins. Managers
      // and admin-role holders can still manage HEAD_REF/REFEREE/PLAYER staff.
      if (role === 'OWNER' || role === 'ADMIN') {
        const actorRole = await getOrgMemberRole(existing.id, interaction.user.id);
        if (!canManageServer && actorRole !== 'OWNER') {
          await interaction.reply({
            content: 'Only an organization owner or Discord server admin can grant the Owner or Admin role.',
            ephemeral: true,
          });
          return;
        }
      }

      const member = await setOrgMemberRole(existing.id, user, role);
      await interaction.reply({
        content:
          role === 'PLAYER'
            ? `Saved <@${user.id}> as PLAYER. They will not get off-guild referee access.`
            : `Saved <@${user.id}> as ${member.role}. They can now use authorized /ref-my workflows from user-installed contexts.`,
        ephemeral: true,
        allowedMentions: { users: [user.id] },
      });
      return;
    }

    if (!canManageServer && (!existing || !(await isOrgAdmin(interaction, existing)))) {
      await interaction.reply({
        content: 'Only a server manager or existing org admin can configure this org.',
        ephemeral: true,
      });
      return;
    }

    // Defer immediately: auto-creating roles + a category + channels takes longer than
    // Discord's 3-second interaction window, so we must acknowledge first.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const autoCreate = interaction.options.getBoolean('auto_create') ?? false;
    const orgSetup = autoCreate ? await ensureOrgDefaults(interaction) : {};

    if (!orgSetup) {
      return;
    }

    const adminRole = interaction.options.getRole('admin_role') ?? orgSetup.adminRole;
    const refereeRole = interaction.options.getRole('referee_role') ?? orgSetup.refereeRole;
    const matchCategory = interaction.options.getChannel('match_category') ?? orgSetup.matchCategory;
    const matchLogChannel = interaction.options.getChannel('match_log_channel') ?? orgSetup.matchLogChannel;
    const evidenceChannel = interaction.options.getChannel('evidence_channel') ?? orgSetup.evidenceChannel;

    const organization = await setupOrganization(interaction, {
      adminRoleId: adminRole?.id,
      refereeRoleId: refereeRole?.id,
      matchCategoryId: matchCategory?.id,
      matchLogChannelId: matchLogChannel?.id,
      evidenceChannelId: evidenceChannel?.id,
    });

    const createdText = autoCreate
      ? [
          `Admin role: ${adminRole}`,
          `Referee role: ${refereeRole}`,
          `Category: ${matchCategory}`,
          `Match logs: ${matchLogChannel}`,
          `Evidence: ${evidenceChannel}`,
        ].join('\n')
      : 'Using the channels/categories you selected.';

    await interaction.editReply({
      content: `Configured ${organization.name}. Match code namespace is now tied to this server.\n${createdText}`,
    });
  },
};

async function ensureOrgDefaults(interaction) {
  if (!interaction.appPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.editReply({
      content: 'I need the Manage Channels permission to auto-create org channels.',
    });
    return null;
  }

  if (!interaction.appPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      content: 'I need the Manage Roles permission to auto-create org roles.',
    });
    return null;
  }

  const guild = interaction.guild;
  await guild.channels.fetch();
  await guild.roles.fetch();

  const adminRole =
    interaction.options.getRole('admin_role') ??
    findRole(guild, 'Esports Admin') ??
    (await guild.roles.create({
      name: 'Esports Admin',
      colors: { primaryColor: 0xe5484d },
      permissions: [],
      reason: `Org setup requested by ${interaction.user.tag}`,
    }));

  const refereeRole =
    interaction.options.getRole('referee_role') ??
    findRole(guild, 'Esports Referee') ??
    (await guild.roles.create({
      name: 'Esports Referee',
      colors: { primaryColor: 0x00a7b5 },
      permissions: [],
      reason: `Org setup requested by ${interaction.user.tag}`,
    }));

  const matchCategory =
    interaction.options.getChannel('match_category') ??
    findChannel(guild, 'Esports Matches', ChannelType.GuildCategory) ??
    (await guild.channels.create({
      name: 'Esports Matches',
      type: ChannelType.GuildCategory,
      reason: `Org setup requested by ${interaction.user.tag}`,
    }));

  const matchLogChannel =
    interaction.options.getChannel('match_log_channel') ??
    findChannel(guild, 'match-logs', ChannelType.GuildText) ??
    (await guild.channels.create({
      name: 'match-logs',
      type: ChannelType.GuildText,
      parent: matchCategory.id,
      topic: 'Automated score reports, referee logs, and match audit references.',
      reason: `Org setup requested by ${interaction.user.tag}`,
    }));

  const evidenceChannel =
    interaction.options.getChannel('evidence_channel') ??
    findChannel(guild, 'evidence-vault', ChannelType.GuildText) ??
    (await guild.channels.create({
      name: 'evidence-vault',
      type: ChannelType.GuildText,
      parent: matchCategory.id,
      topic: 'Evidence references and uploaded proof linked to match disputes.',
      reason: `Org setup requested by ${interaction.user.tag}`,
    }));

  return { adminRole, refereeRole, matchCategory, matchLogChannel, evidenceChannel };
}

function findChannel(guild, name, type) {
  return guild.channels.cache.find((channel) => channel.name === name && channel.type === type);
}

function findRole(guild, name) {
  return guild.roles.cache.find((role) => role.name === name);
}

function formatMembers(members) {
  if (members.length === 0) {
    return 'No saved org admins or referees yet. Use /org member to save them for user-installed workflows.';
  }

  return members
    .map((member) => `<@${member.userProfile.discordUserId}> - ${member.role}`)
    .join('\n')
    .slice(0, 1900);
}
