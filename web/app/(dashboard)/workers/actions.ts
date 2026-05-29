"use server";

import { revalidatePath } from "next/cache";

import { OrgMemberRole } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { OWNER_ADMIN_ROLES, requireOrgRole } from "@/lib/web-authz";

const MANAGEABLE_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.ADMIN,
  OrgMemberRole.MANAGER,
  OrgMemberRole.HEAD_REF,
  OrgMemberRole.REFEREE,
  OrgMemberRole.PLAYER,
]);

function roleFromForm(value: FormDataEntryValue | null) {
  const role = String(value ?? "").toUpperCase();
  if (role === OrgMemberRole.OWNER) return OrgMemberRole.OWNER;
  if (MANAGEABLE_ROLES.has(role as OrgMemberRole)) return role as OrgMemberRole;
  throw new Error("Invalid organization role.");
}

async function loadManagedMember(memberId: string) {
  const member = await prisma.orgMember.findUnique({
    where: { id: memberId },
    include: { userProfile: { select: { displayName: true, discordUserId: true } } },
  });
  if (!member) throw new Error("Organization member not found.");

  const auth = await requireOrgRole(member.organizationId, OWNER_ADMIN_ROLES);
  if (member.role === OrgMemberRole.OWNER && auth.role !== OrgMemberRole.OWNER) {
    throw new Error("Only owners can manage another owner.");
  }

  return { member, auth };
}

async function assertOwnerSafe({
  memberId,
  organizationId,
  currentRole,
  nextRole,
  selfProfileId,
}: {
  memberId: string;
  organizationId: string;
  currentRole: OrgMemberRole;
  nextRole?: OrgMemberRole;
  selfProfileId: string;
}) {
  if (nextRole === OrgMemberRole.OWNER) {
    return;
  }
  if (currentRole !== OrgMemberRole.OWNER) {
    return;
  }

  const ownerCount = await prisma.orgMember.count({
    where: { organizationId, role: OrgMemberRole.OWNER },
  });
  if (ownerCount <= 1) {
    throw new Error("An organization must keep at least one owner.");
  }

  const member = await prisma.orgMember.findUnique({
    where: { id: memberId },
    select: { userProfileId: true },
  });
  if (member?.userProfileId === selfProfileId) {
    throw new Error("Owners cannot demote or remove themselves here.");
  }
}

export async function updateOrgMemberRole(formData: FormData) {
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) throw new Error("Member is required.");
  const nextRole = roleFromForm(formData.get("role"));
  const { member, auth } = await loadManagedMember(memberId);

  if (nextRole === OrgMemberRole.OWNER && auth.role !== OrgMemberRole.OWNER) {
    throw new Error("Only owners can promote members to owner.");
  }

  await assertOwnerSafe({
    memberId,
    organizationId: member.organizationId,
    currentRole: member.role,
    nextRole,
    selfProfileId: auth.profile.id,
  });

  await prisma.$transaction(async (tx) => {
    await tx.orgMember.update({
      where: { id: memberId },
      data: { role: nextRole },
    });
    await tx.auditLog.create({
      data: {
        organizationId: member.organizationId,
        actorId: auth.profile.id,
        action: "web.org.member.role",
        targetType: "OrgMember",
        targetId: memberId,
        metadata: {
          member: member.userProfile.displayName ?? member.userProfile.discordUserId,
          from: member.role,
          to: nextRole,
        },
      },
    });
  });

  revalidatePath("/workers");
  revalidatePath("/org");
}

export async function removeOrgMember(formData: FormData) {
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) throw new Error("Member is required.");
  const { member, auth } = await loadManagedMember(memberId);

  if (member.userProfileId === auth.profile.id) {
    throw new Error("You cannot remove yourself from this screen.");
  }

  await assertOwnerSafe({
    memberId,
    organizationId: member.organizationId,
    currentRole: member.role,
    selfProfileId: auth.profile.id,
  });

  await prisma.$transaction(async (tx) => {
    await tx.orgMember.delete({ where: { id: memberId } });
    await tx.auditLog.create({
      data: {
        organizationId: member.organizationId,
        actorId: auth.profile.id,
        action: "web.org.member.remove",
        targetType: "OrgMember",
        targetId: memberId,
        metadata: {
          member: member.userProfile.displayName ?? member.userProfile.discordUserId,
          role: member.role,
        },
      },
    });
  });

  revalidatePath("/workers");
  revalidatePath("/org");
}
