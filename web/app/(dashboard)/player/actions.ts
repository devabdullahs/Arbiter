"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/web-authz";

function cleanName(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().slice(0, 80);
}

export async function createPlayerTeam(formData: FormData) {
  const { profile } = await requireUserProfile();
  const organizationId = String(formData.get("organizationId") ?? "");
  const name = cleanName(formData.get("name"));

  if (!organizationId) throw new Error("Organization is required.");
  if (!name) throw new Error("Team name is required.");

  const membership = await prisma.orgMember.findUnique({
    where: {
      organizationId_userProfileId: {
        organizationId,
        userProfileId: profile.id,
      },
    },
    select: { id: true },
  });

  if (!membership) {
    throw new Error("You must be a member of that organization to create a team.");
  }

  await prisma.team.create({
    data: {
      organizationId,
      name,
      captainProfileId: profile.id,
      members: {
        create: {
          userProfileId: profile.id,
          displayName: profile.displayName ?? profile.discordUserId,
        },
      },
    },
  });

  revalidatePath("/player");
}

export async function addTeamMember(formData: FormData) {
  const { profile } = await requireUserProfile();
  const teamId = String(formData.get("teamId") ?? "");
  const displayName = cleanName(formData.get("displayName"));
  const discordUserId = String(formData.get("discordUserId") ?? "").replace(/\D/g, "");

  if (!teamId) throw new Error("Team is required.");
  if (!displayName && !discordUserId) {
    throw new Error("Add a display name or Discord user ID.");
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { captainProfileId: true },
  });

  if (!team || team.captainProfileId !== profile.id) {
    throw new Error("Only the team captain can manage teammates.");
  }

  const userProfile = discordUserId
    ? await prisma.userProfile.findUnique({
        where: { discordUserId },
        select: { id: true, displayName: true, discordUserId: true },
      })
    : null;

  await prisma.teamMember.create({
    data: {
      teamId,
      userProfileId: userProfile?.id,
      displayName: displayName || userProfile?.displayName || userProfile?.discordUserId || discordUserId,
    },
  });

  revalidatePath("/player");
}

export async function removeTeamMember(formData: FormData) {
  const { profile } = await requireUserProfile();
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return;

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    include: { team: { select: { captainProfileId: true } } },
  });

  if (!member || member.team.captainProfileId !== profile.id) {
    throw new Error("Only the team captain can remove teammates.");
  }

  await prisma.teamMember.delete({ where: { id: memberId } });
  revalidatePath("/player");
}
