import { OrgMemberRole } from "./generated/prisma";
import { prisma } from "./prisma";
import { getLinkedDiscordId, getSession } from "./auth-session";

export const MANAGER_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.OWNER,
  OrgMemberRole.ADMIN,
  OrgMemberRole.REFEREE,
]);

export const OWNER_ADMIN_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.OWNER,
  OrgMemberRole.ADMIN,
]);

export async function requireUserProfile() {
  const session = await getSession();
  if (!session) throw new Error("You must be signed in.");

  const discordId = await getLinkedDiscordId(session.user.id);
  if (!discordId) throw new Error("Link Discord before using this feature.");

  const profile = await prisma.userProfile.upsert({
    where: { discordUserId: discordId },
    update: { displayName: session.user.name ?? undefined },
    create: { discordUserId: discordId, displayName: session.user.name },
  });

  return { session, discordId, profile };
}

export async function requireOrgRole(
  organizationId: string,
  allowedRoles: Set<OrgMemberRole>,
) {
  const auth = await requireUserProfile();
  const membership = await prisma.orgMember.findUnique({
    where: {
      organizationId_userProfileId: {
        organizationId,
        userProfileId: auth.profile.id,
      },
    },
    select: { role: true },
  });

  if (!membership || !allowedRoles.has(membership.role)) {
    throw new Error("You do not have permission for this organization.");
  }

  return { ...auth, role: membership.role };
}

export async function enqueueDiscordMatchRefresh(
  organizationId: string,
  matchId: string,
) {
  await prisma.discordSyncJob.create({
    data: {
      organizationId,
      targetType: "match",
      targetId: matchId,
      action: "refresh",
    },
  });
}

export async function enqueueDiscordBrRefresh(
  organizationId: string,
  lobbyId: string,
) {
  await prisma.discordSyncJob.create({
    data: {
      organizationId,
      targetType: "br_lobby",
      targetId: lobbyId,
      action: "refresh",
    },
  });
}
