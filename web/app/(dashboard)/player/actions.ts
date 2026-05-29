"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/web-authz";

function cleanName(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().slice(0, 80);
}

function cleanTeamRole(value: FormDataEntryValue | null) {
  const role = String(value ?? "player");
  return ["player", "substitute", "coach", "manager", "team_leader"].includes(role)
    ? role
    : "player";
}

function revalidatePlayerPages() {
  revalidatePath("/player");
  revalidatePath("/player/matches");
  revalidatePath("/player/teams");
  revalidatePath("/player/checkins");
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

  const existingTeam = await prisma.team.findFirst({
    where: {
      organizationId,
      captainProfileId: profile.id,
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existingTeam) {
    revalidatePlayerPages();
    return;
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
          teamRole: "team_leader",
        },
      },
    },
  });

  revalidatePlayerPages();
}

export async function addTeamMember(formData: FormData) {
  const { profile } = await requireUserProfile();
  const teamId = String(formData.get("teamId") ?? "");
  const displayName = cleanName(formData.get("displayName"));
  const discordUserId = String(formData.get("discordUserId") ?? "").replace(/\D/g, "");
  const teamRole = cleanTeamRole(formData.get("teamRole"));

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
  const resolvedDisplayName =
    displayName || userProfile?.displayName || userProfile?.discordUserId || discordUserId;
  const existingMember = await prisma.teamMember.findFirst({
    where: {
      teamId,
      OR: [
        ...(userProfile?.id ? [{ userProfileId: userProfile.id }] : []),
        {
          displayName: {
            equals: resolvedDisplayName,
            mode: "insensitive",
          },
        },
      ],
    },
    select: { id: true },
  });

  if (existingMember) {
    revalidatePlayerPages();
    return;
  }

  await prisma.teamMember.create({
    data: {
      teamId,
      userProfileId: userProfile?.id,
      displayName: resolvedDisplayName,
      teamRole,
    },
  });

  revalidatePlayerPages();
}

const ROLE_MANAGER_ROLES = new Set(["manager", "team_leader"]);

async function assertCanManageTeam(teamId: string, profileId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      captainProfileId: true,
      members: {
        where: { userProfileId: profileId },
        select: { teamRole: true },
      },
    },
  });

  if (!team) throw new Error("Team not found.");
  const isCaptain = team.captainProfileId === profileId;
  const isManager = team.members.some((member) =>
    ROLE_MANAGER_ROLES.has(member.teamRole),
  );
  if (!isCaptain && !isManager) {
    throw new Error(
      "Only the team owner or a manager can manage team member roles.",
    );
  }
  return { isCaptain };
}

export async function updateTeamMemberRole(formData: FormData) {
  const { profile } = await requireUserProfile();
  const memberId = String(formData.get("memberId") ?? "");
  const teamRole = cleanTeamRole(formData.get("teamRole"));
  if (!memberId) throw new Error("Team member is required.");

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { id: true, teamId: true, team: { select: { captainProfileId: true } } },
  });
  if (!member) throw new Error("Team member not found.");

  await assertCanManageTeam(member.teamId, profile.id);

  // The team owner (captain) keeps their leadership slot; don't let a role
  // change strand a team without a leader.
  if (member.team.captainProfileId && member.teamId) {
    const isCaptainMember =
      (
        await prisma.teamMember.findFirst({
          where: { id: memberId, userProfileId: member.team.captainProfileId },
          select: { id: true },
        })
      ) !== null;
    if (isCaptainMember && teamRole !== "team_leader") {
      throw new Error("The team owner stays the team leader.");
    }
  }

  await prisma.teamMember.update({
    where: { id: memberId },
    data: { teamRole },
  });

  revalidatePlayerPages();
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
  revalidatePlayerPages();
}

export async function submitPlayerCheckin(formData: FormData) {
  const { profile } = await requireUserProfile();
  const matchCode = String(formData.get("matchCode") ?? "").trim().toUpperCase();
  const gameAccount = String(formData.get("gameAccount") ?? "").trim().slice(0, 120);

  if (!matchCode) throw new Error("Match code is required.");
  if (!gameAccount) throw new Error("Game account is required.");

  const match = await prisma.match.findUnique({
    where: { publicCode: matchCode },
    include: {
      participants: {
        include: {
          team: {
            include: {
              members: { where: { userProfileId: profile.id }, select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!match) throw new Error("Match not found.");
  const isInMatch = match.participants.some(
    (participant) =>
      participant.team.captainProfileId === profile.id ||
      participant.team.members.length > 0,
  );

  if (!isInMatch) {
    throw new Error("You can only check in for matches assigned to your team.");
  }

  await prisma.checkin.create({
    data: {
      organizationId: match.organizationId,
      matchId: match.id,
      userProfileId: profile.id,
      gameAccount,
      validation: {
        source: "web",
        status: "submitted",
      },
    },
  });

  revalidatePlayerPages();
  revalidatePath(`/matches/${match.publicCode}`);
}
