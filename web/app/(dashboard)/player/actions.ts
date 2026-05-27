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
