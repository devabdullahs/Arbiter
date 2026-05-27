import { headers } from "next/headers";

import { auth } from "./auth";
import { OrgMemberRole } from "./generated/prisma";
import { prisma } from "./prisma";

/** Current Better Auth session (or null) for the incoming request. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export type AccessibleOrg = {
  id: string;
  name: string;
  discordGuildId: string;
  role: OrgMemberRole;
};

/** The Discord user id linked to this Better Auth user, if any. */
export async function getLinkedDiscordId(
  userId: string,
): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "discord" },
    select: { accountId: true },
  });
  return account?.accountId ?? null;
}

/**
 * Orgs the signed-in user can view: resolved by mapping their linked Discord
 * account -> UserProfile.discordUserId -> OrgMember rows where they are an
 * owner/admin/referee. Authentication is multi-method, but authorization is
 * Discord-based (mirrors the bot's isOrgRefereeOrAdmin gate).
 */
export async function getAccessibleOrgs(
  userId: string,
): Promise<{ discordId: string | null; orgs: AccessibleOrg[] }> {
  const discordId = await getLinkedDiscordId(userId);
  if (!discordId) return { discordId: null, orgs: [] };

  const profile = await prisma.userProfile.findUnique({
    where: { discordUserId: discordId },
    select: { id: true },
  });
  if (!profile) return { discordId, orgs: [] };

  const memberships = await prisma.orgMember.findMany({
    where: {
      userProfileId: profile.id,
      role: {
        in: [OrgMemberRole.OWNER, OrgMemberRole.ADMIN, OrgMemberRole.REFEREE],
      },
    },
    include: { organization: true },
    orderBy: { organization: { name: "asc" } },
  });

  return {
    discordId,
    orgs: memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      discordGuildId: m.organization.discordGuildId,
      role: m.role,
    })),
  };
}

/**
 * Convenience for data pages: returns the session, accessible orgs, and a flat
 * list of org ids to scope queries by. Returns null when not signed in (the
 * dashboard layout already redirects, but this also narrows types for pages).
 */
export async function getAccessContext() {
  const session = await getSession();
  if (!session) return null;
  const { discordId, orgs } = await getAccessibleOrgs(session.user.id);
  return {
    session,
    discordId,
    orgs,
    orgIds: orgs.map((o) => o.id),
  };
}
