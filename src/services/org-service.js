import { PermissionFlagsBits } from 'discord.js';
import { prisma } from '../db/prisma.js';
import { ensureUserProfile } from './profile-service.js';

export async function resolveOrganizationByGuild(guild) {
  if (!guild?.id) {
    return null;
  }

  return prisma.organization.findUnique({
    where: { discordGuildId: guild.id },
    include: { settings: true },
  });
}

export async function setupOrganization(interaction, input) {
  const actor = await ensureUserProfile(interaction.user);
  const organization = await prisma.organization.upsert({
    where: { discordGuildId: interaction.guildId },
    update: { name: interaction.guild.name },
    create: { discordGuildId: interaction.guildId, name: interaction.guild.name },
  });

  const settings = await prisma.orgSettings.upsert({
    where: { organizationId: organization.id },
    update: {
      adminRoleId: input.adminRoleId,
      refereeRoleId: input.refereeRoleId,
      matchCategoryId: input.matchCategoryId,
      matchLogChannelId: input.matchLogChannelId,
      evidenceChannelId: input.evidenceChannelId,
    },
    create: {
      organizationId: organization.id,
      adminRoleId: input.adminRoleId,
      refereeRoleId: input.refereeRoleId,
      matchCategoryId: input.matchCategoryId,
      matchLogChannelId: input.matchLogChannelId,
      evidenceChannelId: input.evidenceChannelId,
    },
  });

  const ownerCount = await prisma.orgMember.count({
    where: { organizationId: organization.id, role: 'OWNER' },
  });
  const existingMember = await prisma.orgMember.findUnique({
    where: {
      organizationId_userProfileId: {
        organizationId: organization.id,
        userProfileId: actor.id,
      },
    },
  });

  if (!existingMember) {
    await prisma.orgMember.create({
      data: {
        organizationId: organization.id,
        userProfileId: actor.id,
        role: ownerCount === 0 ? 'OWNER' : 'ADMIN',
      },
    });
  }

  await writeAuditLog({
    organizationId: organization.id,
    actorId: actor.id,
    action: 'org.setup',
    targetType: 'organization',
    targetId: organization.id,
    metadata: {
      adminRoleId: settings.adminRoleId,
      refereeRoleId: settings.refereeRoleId,
      matchCategoryId: settings.matchCategoryId,
      matchLogChannelId: settings.matchLogChannelId,
      evidenceChannelId: settings.evidenceChannelId,
    },
  });

  return { ...organization, settings };
}

export async function getOrganizationForInteraction(interaction) {
  if (!interaction.guildId) {
    return null;
  }

  return resolveOrganizationByGuild(interaction.guild);
}

export async function requireOrganization(interaction) {
  const organization = await getOrganizationForInteraction(interaction);

  if (!organization) {
    throw new Error('This server is not configured yet. Run /org setup first.');
  }

  return organization;
}

export async function getOrgMemberRole(organizationId, discordUserId) {
  const profile = await prisma.userProfile.findUnique({ where: { discordUserId } });

  if (!profile) {
    return null;
  }

  const membership = await prisma.orgMember.findUnique({
    where: {
      organizationId_userProfileId: {
        organizationId,
        userProfileId: profile.id,
      },
    },
  });

  return membership?.role ?? null;
}

export async function setOrgMemberRole(organizationId, user, role) {
  const profile = await ensureUserProfile(user);

  return prisma.orgMember.upsert({
    where: {
      organizationId_userProfileId: {
        organizationId,
        userProfileId: profile.id,
      },
    },
    update: { role },
    create: {
      organizationId,
      userProfileId: profile.id,
      role,
    },
    include: { userProfile: true },
  });
}

export async function listOrgMembers(organizationId) {
  return prisma.orgMember.findMany({
    where: { organizationId, role: { in: ['OWNER', 'ADMIN', 'MANAGER', 'HEAD_REF', 'REFEREE'] } },
    include: { userProfile: true },
    orderBy: [{ role: 'asc' }, { updatedAt: 'desc' }],
    take: 50,
  });
}

export async function hasOrgRefereeOrAdminAccess(organizationId, discordUserId) {
  const role = await getOrgMemberRole(organizationId, discordUserId);
  return role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER' || role === 'HEAD_REF' || role === 'REFEREE';
}

export async function listRefereeOrganizationsForUser(discordUserId) {
  const profile = await prisma.userProfile.findUnique({
    where: { discordUserId },
    include: {
      memberships: {
        where: { role: { in: ['OWNER', 'ADMIN', 'MANAGER', 'HEAD_REF', 'REFEREE'] } },
        include: { organization: { include: { settings: true } } },
      },
    },
  });

  return profile?.memberships.map((membership) => membership.organization) ?? [];
}

export async function isOrgAdmin(interaction, organization) {
  if (!interaction.guildId) {
    return false;
  }

  if (
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)
  ) {
    return true;
  }

  if (organization.settings?.adminRoleId && interaction.member?.roles?.cache?.has(organization.settings.adminRoleId)) {
    return true;
  }

  const role = await getOrgMemberRole(organization.id, interaction.user.id);
  return role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER';
}

export async function isOrgRefereeOrAdmin(interaction, organization) {
  if (await isOrgAdmin(interaction, organization)) {
    return true;
  }

  if (!interaction.guildId) {
    return false;
  }

  if (
    organization.settings?.refereeRoleId &&
    interaction.member?.roles?.cache?.has(organization.settings.refereeRoleId)
  ) {
    return true;
  }

  const role = await getOrgMemberRole(organization.id, interaction.user.id);
  return role === 'REFEREE' || role === 'HEAD_REF';
}

export async function writeAuditLog(input) {
  return prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? undefined,
    },
  });
}
