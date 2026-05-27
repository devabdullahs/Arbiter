"use server";

import { revalidatePath } from "next/cache";

import { getLinkedDiscordId, getSession } from "@/lib/auth-session";
import { OrgMemberRole } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

const ACCEPTABLE_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.ADMIN,
  OrgMemberRole.REFEREE,
  OrgMemberRole.PLAYER,
]);

export type AcceptInviteResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function acceptOrgInvite(token: string): Promise<AcceptInviteResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "Sign in first, then return to this invite." };
  }

  const invite = await prisma.orgInvite.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });

  if (!invite) return { ok: false, message: "This invite does not exist." };
  if (invite.status !== "pending") {
    return { ok: false, message: `This invite is already ${invite.status}.` };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.orgInvite.update({
      where: { id: invite.id },
      data: { status: "revoked" },
    });
    return { ok: false, message: "This invite expired." };
  }
  if (session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return {
      ok: false,
      message: `This invite was sent to ${invite.email}. Sign in with that email to accept it.`,
    };
  }

  const discordId = await getLinkedDiscordId(session.user.id);
  if (!discordId) {
    return {
      ok: false,
      message: "Link your Discord account before accepting this invite.",
    };
  }

  const profile = await prisma.userProfile.upsert({
    where: { discordUserId: discordId },
    update: { displayName: session.user.name },
    create: { discordUserId: discordId, displayName: session.user.name },
  });

  const role = ACCEPTABLE_ROLES.has(invite.role) ? invite.role : OrgMemberRole.REFEREE;

  await prisma.$transaction([
    prisma.orgMember.upsert({
      where: {
        organizationId_userProfileId: {
          organizationId: invite.organizationId,
          userProfileId: profile.id,
        },
      },
      update: { role },
      create: {
        organizationId: invite.organizationId,
        userProfileId: profile.id,
        role,
      },
    }),
    prisma.orgInvite.update({
      where: { id: invite.id },
      data: {
        status: "accepted",
        acceptedById: profile.id,
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId: invite.organizationId,
        actorId: profile.id,
        action: "org.invite.accepted",
        targetType: "OrgInvite",
        targetId: invite.id,
        metadata: {
          email: invite.email,
          role,
          betterAuthUserId: session.user.id,
        },
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/org");

  return {
    ok: true,
    message: `You joined ${invite.organization.name} as ${role.toLowerCase()}.`,
  };
}
