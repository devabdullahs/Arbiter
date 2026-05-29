"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  DEFAULT_MAPS,
  builtInPreset,
  splitPresetList,
} from "@/lib/game-presets";
import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, requireOrgRole } from "@/lib/web-authz";


function makeMatchCode() {
  return randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
}

function cleanText(value: FormDataEntryValue | null, max = 80) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanBestOf(value: FormDataEntryValue | null) {
  const bestOf = Number.parseInt(String(value ?? "3"), 10);
  return Number.isFinite(bestOf) && bestOf >= 1 && bestOf <= 99 ? bestOf : 3;
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
    : [];
}

async function resolveRulesPreset(organizationId: string, rawChoice: string) {
  if (rawChoice.startsWith("org:")) {
    const preset = await prisma.rulesPreset.findFirst({
      where: { id: rawChoice.slice(4), organizationId },
      select: {
        key: true,
        mapPool: true,
        characterPool: true,
        vetoMode: true,
      },
    });
    if (!preset) throw new Error("Selected organization preset was not found.");

    return {
      rulesPreset: preset.key,
      mapPool: jsonStringArray(preset.mapPool),
      characterPool: jsonStringArray(preset.characterPool),
      vetoMode: preset.vetoMode,
    };
  }

  const preset = builtInPreset(rawChoice) ?? builtInPreset("generic");
  return {
    rulesPreset: preset?.key ?? "generic",
    mapPool: preset?.mapPool ?? DEFAULT_MAPS,
    characterPool: preset?.characterPool ?? [],
    vetoMode: preset?.vetoMode ?? "series_picks",
  };
}

function cleanPositiveInt(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function cleanTeamSlot(value: FormDataEntryValue | null) {
  return String(value ?? "teamA") === "teamB" ? "teamB" : "teamA";
}

function cleanTimeoutAction(value: FormDataEntryValue | null) {
  const action = String(value ?? "referee_choice");
  return ["referee_choice", "extra_turn", "skip"].includes(action)
    ? action
    : "referee_choice";
}

function cleanCharacterBanMode(value: FormDataEntryValue | null) {
  const mode = String(value ?? "none");
  return [
    "none",
    "generic",
    "valorant_protect_ban",
    "lol_fearless_draft",
    "owcs_ranked_vote",
    "valorant_agents",
    "lol_champions",
    "overwatch_heroes",
  ].includes(mode)
    ? mode
    : "none";
}

export type CreateWebMatchState = {
  error?: string;
};

function actionError(error: unknown) {
  return error instanceof Error ? error.message : "Could not create match.";
}

async function createWebMatchRecord(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) throw new Error("Organization is required.");

  const auth = await requireOrgRole(organizationId, MANAGER_ROLES);
  const teamAId = cleanText(formData.get("teamAId"), 80);
  const teamBId = cleanText(formData.get("teamBId"), 80);
  const bestOf = cleanBestOf(formData.get("bestOf"));
  const presetChoice = cleanText(formData.get("rulesPreset"), 120) || "generic";
  const preset = await resolveRulesPreset(organizationId, presetChoice);
  const rulesPreset = preset.rulesPreset;
  const vetoMode = cleanText(formData.get("vetoMode"), 40) || preset.vetoMode;
  const customMapPool = splitPresetList(formData.get("mapPool"));
  const mapPool = customMapPool.length ? customMapPool : preset.mapPool;
  const characterBanMode = cleanCharacterBanMode(formData.get("characterBanMode"));
  const customCharacterPool = splitPresetList(formData.get("characterPool"));
  const characterPool = customCharacterPool.length
    ? customCharacterPool
    : preset.characterPool;

  if (teamAId && teamBId && teamAId === teamBId) {
    throw new Error("Select two different teams.");
  }

  const selectedTeams = teamAId || teamBId
    ? await prisma.team.findMany({
        where: {
          organizationId,
          id: { in: [teamAId, teamBId].filter(Boolean) },
        },
        select: { id: true, name: true },
      })
    : [];
  const teamsById = new Map(selectedTeams.map((team) => [team.id, team]));
  const teamA = teamAId ? teamsById.get(teamAId) : null;
  const teamB = teamBId ? teamsById.get(teamBId) : null;
  if (teamAId && !teamA) throw new Error("Team A is not in this organization.");
  if (teamBId && !teamB) throw new Error("Team B is not in this organization.");

  const teamAName = teamA?.name ?? cleanText(formData.get("teamAName"));
  const teamBName = teamB?.name ?? cleanText(formData.get("teamBName"));

  if (!teamAName || !teamBName) {
    throw new Error("Select existing teams or enter both custom team names.");
  }

  const match = await prisma.$transaction(async (tx) => {
    const created = await tx.match.create({
      data: {
        publicCode: makeMatchCode(),
        organizationId,
        createdById: auth.profile.id,
        teamAName,
        teamBName,
        bestOf,
        rulesPreset,
        vetoMode,
        vetoStartingTeam: cleanTeamSlot(formData.get("vetoStartingTeam")),
        vetoTimerSeconds: cleanPositiveInt(formData.get("vetoTimerSeconds"), 60, 10, 600),
        vetoTimeoutAction: cleanTimeoutAction(formData.get("vetoTimeoutAction")),
        characterBanMode,
        characterBanTimerSeconds: cleanPositiveInt(formData.get("characterBanTimerSeconds"), 30, 5, 300),
        characterPool: characterBanMode === "none" ? undefined : characterPool,
        mapPool,
        allowPlayerReports: formData.get("allowPlayerReports") === "on",
      },
      select: { id: true, publicCode: true },
    });

    const participants = [
      teamA ? { matchId: created.id, teamId: teamA.id, slot: "teamA" } : null,
      teamB ? { matchId: created.id, teamId: teamB.id, slot: "teamB" } : null,
    ].filter((entry): entry is { matchId: string; teamId: string; slot: string } =>
      Boolean(entry),
    );
    if (participants.length) {
      await tx.matchParticipant.createMany({ data: participants });
    }

    await tx.auditLog.create({
      data: {
          organizationId,
          actorId: auth.profile.id,
          action: "web.match.create",
          targetType: "match",
          targetId: created.id,
          metadata: {
            publicCode: created.publicCode,
            teamAName,
            teamBName,
            teamAId: teamA?.id,
            teamBId: teamB?.id,
            bestOf,
            rulesPreset,
          },
        },
      });

    return created;
  });

  revalidatePath("/matches");
  return match;
}

export async function createWebMatch(formData: FormData) {
  const match = await createWebMatchRecord(formData);
  redirect(`/matches/${match.publicCode}`);
}

export async function createWebMatchWithState(
  _state: CreateWebMatchState,
  formData: FormData,
): Promise<CreateWebMatchState> {
  let match: { publicCode: string };
  try {
    match = await createWebMatchRecord(formData);
  } catch (error) {
    return { error: actionError(error) };
  }

  redirect(`/matches/${match.publicCode}`);
}
