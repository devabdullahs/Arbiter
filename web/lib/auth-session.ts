import { cache } from "react";
import { headers } from "next/headers";

import { auth } from "./auth";
import { OrgMemberRole } from "./generated/prisma";
import { getActiveOrgId } from "./org-selection";
import { prisma } from "./prisma";

// These helpers are called from multiple places in a single render pass (the
// dashboard layout, each page, the sidebar, breadcrumbs...). Wrapping them in
// React.cache() memoizes the result per request, so the underlying DB/session
// lookups run once per request instead of once per caller. cache() does NOT
// persist across requests, so there is no staleness risk.

/** Current Better Auth session (or null) for the incoming request. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export type AccessibleOrg = {
  id: string;
  name: string;
  discordGuildId: string;
  role: OrgMemberRole;
};

export function isStaffRole(role: OrgMemberRole) {
  return (
    role === OrgMemberRole.OWNER ||
    role === OrgMemberRole.ADMIN ||
    role === OrgMemberRole.MANAGER ||
    role === OrgMemberRole.HEAD_REF ||
    role === OrgMemberRole.REFEREE
  );
}

/** The Discord user id linked to this Better Auth user, if any. */
export const getLinkedDiscordId = cache(
  async (userId: string): Promise<string | null> => {
    const account = await prisma.account.findFirst({
      where: { userId, providerId: "discord" },
      select: { accountId: true },
    });
    return account?.accountId ?? null;
  },
);

/**
 * Orgs the signed-in user belongs to: resolved by mapping their linked Discord
 * account -> UserProfile.discordUserId -> OrgMember rows. Staff pages still
 * scope themselves to owner/admin/referee roles; player memberships are exposed
 * here so the shell can offer a real player view for orgs where the user is not
 * staff.
 */
export const getAccessibleOrgs = cache(async function getAccessibleOrgs(
  userId: string,
): Promise<{ discordId: string | null; orgs: AccessibleOrg[] }> {
  const discordId = await getLinkedDiscordId(userId);
  if (!discordId) return { discordId: null, orgs: [] };

  // Filter OrgMember through its UserProfile relation in one query, so we don't
  // need a separate UserProfile lookup. Empty result also covers the
  // "Discord linked but no profile yet" case (orgs: []).
  const memberships = await prisma.orgMember.findMany({
    where: {
      userProfile: { discordUserId: discordId },
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
});

/**
 * Convenience for data pages: returns the session, accessible orgs, and a flat
 * list of org ids to scope queries by. Returns null when not signed in (the
 * dashboard layout already redirects, but this also narrows types for pages).
 */
export const getAccessContext = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const { discordId, orgs } = await getAccessibleOrgs(session.user.id);
  const activeOrgId = await getActiveOrgId();
  const activeOrg =
    orgs.find((org) => org.id === activeOrgId) ?? orgs[0] ?? null;
  const activeStaffOrg = activeOrg && isStaffRole(activeOrg.role) ? activeOrg : null;
  const staffOrgs = orgs.filter((org) => isStaffRole(org.role));
  const playerOrgs = orgs.filter((org) => org.role === OrgMemberRole.PLAYER);
  return {
    session,
    discordId,
    orgs,
    staffOrgs,
    playerOrgs,
    activeOrg,
    activeStaffOrg,
    orgIds: activeStaffOrg ? [activeStaffOrg.id] : [],
    staffOrgIds: activeStaffOrg ? [activeStaffOrg.id] : [],
    playerOrgIds: activeOrg ? [activeOrg.id] : [],
    isActiveOrgStaff: Boolean(activeStaffOrg),
  };
});
