"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { revalidatePath } from "next/cache";

import { MatchStatus, OrgMemberRole, Prisma, VetoKind } from "@/lib/generated/prisma";
import {
  DEFAULT_MAPS,
  builtInPreset,
  splitPresetList,
} from "@/lib/game-presets";
import { prisma } from "@/lib/prisma";
import { cleanResultLabel } from "@/lib/score-format";
import {
  enqueueDiscordMatchRefresh,
  MANAGER_ROLES,
  REFEREE_ASSIGNMENT_MANAGER_ROLES,
  requireOrgRole,
  requireUserProfile,
} from "@/lib/web-authz";

const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
const EVIDENCE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const TEAM_VETO_ROLES = new Set(["captain", "coach", "manager", "team_leader"]);
const REFEREE_ASSIGNABLE_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.OWNER,
  OrgMemberRole.ADMIN,
  OrgMemberRole.MANAGER,
  OrgMemberRole.HEAD_REF,
  OrgMemberRole.REFEREE,
]);

function cleanText(value: FormDataEntryValue | null, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanInt(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Scores must be zero or greater.");
  }
  return parsed;
}

function cleanScoreType(value: FormDataEntryValue | null) {
  const type = String(value ?? "match");
  return ["match", "map", "round", "game", "penalty"].includes(type)
    ? type
    : "match";
}

function cleanPositiveInt(
  value: FormDataEntryValue | null,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback;
}

function cleanClaimMode(value: FormDataEntryValue | null) {
  const mode = String(value ?? "open");
  return ["open", "assigned", "tournament"].includes(mode) ? mode : "open";
}

function cleanClaimLimit(value: FormDataEntryValue | null, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12
    ? parsed
    : fallback;
}

function cleanOneOf(value: FormDataEntryValue | null, allowed: Set<string>, fallback: string) {
  const clean = String(value ?? fallback);
  return allowed.has(clean) ? clean : fallback;
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
    : [];
}

async function resolveRulesPresetForMatch(organizationId: string, rawChoice: string) {
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
      forcePools: true,
    };
  }

  const preset = builtInPreset(rawChoice);
  if (!preset) {
    return {
      rulesPreset: rawChoice,
      mapPool: [] as string[],
      characterPool: [] as string[],
      vetoMode: "",
      forcePools: false,
    };
  }

  return {
    rulesPreset: preset.key,
    mapPool: preset.mapPool.length ? preset.mapPool : DEFAULT_MAPS,
    characterPool: preset.characterPool,
    vetoMode: preset.vetoMode,
    forcePools: false,
  };
}

function cleanStatus(value: FormDataEntryValue | null) {
  const status = String(value ?? "").toUpperCase();
  if (
    status === MatchStatus.PENDING ||
    status === MatchStatus.VETO ||
    status === MatchStatus.LIVE ||
    status === MatchStatus.DISPUTED ||
    status === MatchStatus.COMPLETE ||
    status === MatchStatus.CANCELLED
  ) {
    return status;
  }
  throw new Error("Invalid match status.");
}

function cleanTeamSlot(value: FormDataEntryValue | null) {
  return String(value ?? "teamA") === "teamB" ? "teamB" : "teamA";
}

async function isProfileMatchParticipant(matchId: string, profileId: string) {
  const count = await prisma.matchParticipant.count({
    where: {
      matchId,
      team: {
        OR: [
          { captainProfileId: profileId },
          { members: { some: { userProfileId: profileId } } },
        ],
      },
    },
  });
  return count > 0;
}

async function assertNotMatchParticipant(matchId: string, profileId: string) {
  if (await isProfileMatchParticipant(matchId, profileId)) {
    throw new Error(
      "You are linked to a team in this match, so operational controls are hidden for conflict-of-interest safety.",
    );
  }
}

function effectiveClaimMode(match: {
  refereeClaimMode: string;
  tournament: { refereeClaimMode: string; refereeClaimLimit: number } | null;
}) {
  return match.refereeClaimMode === "tournament"
    ? match.tournament?.refereeClaimMode ?? "open"
    : match.refereeClaimMode;
}

function effectiveClaimLimit(match: {
  refereeClaimMode: string;
  refereeClaimLimit: number;
  tournament: { refereeClaimMode: string; refereeClaimLimit: number } | null;
}) {
  return Math.max(
    1,
    match.refereeClaimMode === "tournament"
      ? match.tournament?.refereeClaimLimit ?? match.refereeClaimLimit
      : match.refereeClaimLimit,
  );
}

function otherTeamSlot(slot: string) {
  return slot === "teamB" ? "teamA" : "teamB";
}

function cleanActionSource(value: FormDataEntryValue | null) {
  const source = String(value ?? "team");
  return ["team", "referee_choice", "timeout_skip", "timeout_extra_turn"].includes(source)
    ? source
    : "team";
}

function cleanCharacterAction(value: FormDataEntryValue | null) {
  const action = String(value ?? "ban");
  return ["ban", "protect", "vote", "fearless_lock"].includes(action)
    ? action
    : "ban";
}

function mapNameOf(entry: unknown) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && "map" in entry) {
    const map = (entry as { map?: unknown }).map;
    return typeof map === "string" ? map : "";
  }
  return "";
}

function mapModeOf(entry: unknown) {
  if (entry && typeof entry === "object" && "mode" in entry) {
    const mode = (entry as { mode?: unknown }).mode;
    return typeof mode === "string" ? mode : null;
  }
  return null;
}

function normalizeMapPool(mapPool: unknown) {
  return Array.isArray(mapPool)
    ? mapPool
        .map((entry) => ({
          name: mapNameOf(entry).trim(),
          mode: mapModeOf(entry),
        }))
        .filter((entry) => entry.name)
    : [];
}

function nextVetoState(match: {
  bestOf: number;
  vetoMode: string;
  vetoStartingTeam: string;
  mapPool: unknown;
  vetoActions: Array<{ kind: VetoKind; teamSlot: string; mapName: string }>;
}) {
  const picks = match.vetoActions.filter((action) => action.kind === VetoKind.PICK);
  const bans = match.vetoActions.filter((action) => action.kind === VetoKind.BAN);
  const startingTeam = cleanTeamSlot(match.vetoStartingTeam);
  const turnFor = (count: number) => (count % 2 === 0 ? startingTeam : otherTeamSlot(startingTeam));

  if (match.vetoMode === "series_picks" || match.vetoMode === "manual_picks") {
    return {
      kind: VetoKind.PICK,
      teamSlot: turnFor(picks.length),
    };
  }

  const mapPool = normalizeMapPool(match.mapPool);
  const bansNeeded = Math.max(0, mapPool.length - match.bestOf);
  return {
    kind: bans.length < bansNeeded ? VetoKind.BAN : VetoKind.PICK,
    teamSlot: turnFor(bans.length + picks.length),
  };
}

function nextCharacterBanState(match: {
  vetoStartingTeam: string;
  characterBanActions: Array<{ teamSlot: string }>;
}) {
  const startingTeam = cleanTeamSlot(match.vetoStartingTeam);
  const count = match.characterBanActions.length;
  return count % 2 === 0 ? startingTeam : otherTeamSlot(startingTeam);
}

async function loadMatchForAction(code: string) {
  const match = await prisma.match.findUnique({
    where: { publicCode: code.toUpperCase() },
    select: {
      id: true,
      publicCode: true,
      organizationId: true,
      teamAName: true,
      teamBName: true,
      bestOf: true,
      rulesPreset: true,
      vetoMode: true,
      vetoStartingTeam: true,
      vetoTimerSeconds: true,
      vetoTimeoutAction: true,
      characterBanMode: true,
      characterBanTimerSeconds: true,
      characterPool: true,
      mapPool: true,
      finalMap: true,
      status: true,
      vetoActions: {
        orderBy: { createdAt: "asc" },
        select: { id: true, kind: true, teamSlot: true, mapName: true },
      },
      characterBanActions: {
        orderBy: { createdAt: "asc" },
        select: { teamSlot: true, action: true, character: true, gameRole: true },
      },
    },
  });

  if (!match) throw new Error("Match not found.");
  const auth = await requireOrgRole(match.organizationId, MANAGER_ROLES);
  await assertNotMatchParticipant(match.id, auth.profile.id);
  return { match, auth };
}

async function loadMatchForTeamVetoAction(code: string) {
  const auth = await requireUserProfile();
  const match = await prisma.match.findUnique({
    where: { publicCode: code.toUpperCase() },
    select: {
      id: true,
      publicCode: true,
      organizationId: true,
      bestOf: true,
      vetoMode: true,
      vetoStartingTeam: true,
      vetoTimerSeconds: true,
      vetoTimeoutAction: true,
      mapPool: true,
      finalMap: true,
      status: true,
      vetoActions: {
        orderBy: { createdAt: "asc" },
        select: { id: true, kind: true, teamSlot: true, mapName: true },
      },
      participants: {
        select: {
          slot: true,
          team: {
            select: {
              captainProfileId: true,
              members: {
                select: { userProfileId: true, teamRole: true },
              },
            },
          },
        },
      },
    },
  });

  if (!match) throw new Error("Match not found.");
  return { match, auth };
}

async function saveEvidenceFile(matchId: string, value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null;

  const extension = EVIDENCE_TYPES[value.type];
  if (!extension) throw new Error("Evidence upload must be a PNG, JPG, or WebP image.");
  if (value.size > MAX_EVIDENCE_BYTES) {
    throw new Error("Evidence upload must be 8 MB or smaller.");
  }

  const bytes = Buffer.from(await value.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", "uploads", "evidence");
  await mkdir(uploadDir, { recursive: true });
  const filename = `${matchId}-${Date.now()}.${extension}`;
  await writeFile(path.join(uploadDir, filename), bytes);
  return `/uploads/evidence/${filename}`;
}

export async function updateWebMatchSettings(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForAction(code);
  const bestOf = cleanPositiveInt(formData.get("bestOf"), match.bestOf, 1, 99);
  const presetChoice = cleanText(formData.get("rulesPreset"), 120) || match.rulesPreset;
  const preset = await resolveRulesPresetForMatch(match.organizationId, presetChoice);
  const rulesPreset = preset.rulesPreset || match.rulesPreset;
  const selectedDifferentPreset = rulesPreset !== match.rulesPreset;
  const vetoMode = cleanOneOf(
    formData.get("vetoMode"),
    new Set(["final_map_ban", "series_picks", "manual_picks"]),
    preset.vetoMode || match.vetoMode,
  );
  const vetoStartingTeam = cleanTeamSlot(formData.get("vetoStartingTeam"));
  const vetoTimerSeconds = cleanPositiveInt(
    formData.get("vetoTimerSeconds"),
    match.vetoTimerSeconds,
    10,
    900,
  );
  const vetoTimeoutAction = cleanOneOf(
    formData.get("vetoTimeoutAction"),
    new Set(["referee_choice", "timeout_skip", "timeout_extra_turn", "skip", "extra_turn"]),
    match.vetoTimeoutAction,
  );
  const characterBanMode = cleanOneOf(
    formData.get("characterBanMode"),
    new Set(["none", "generic", "generic_ban", "valorant_protect_ban", "lol_fearless_draft", "owcs_ranked_vote", "valorant_agents", "lol_champions", "overwatch_heroes"]),
    match.characterBanMode,
  );
  const characterBanTimerSeconds = cleanPositiveInt(
    formData.get("characterBanTimerSeconds"),
    match.characterBanTimerSeconds,
    10,
    900,
  );
  const customMapPool = splitPresetList(formData.get("mapPool"));
  const customCharacterPool = splitPresetList(formData.get("characterPool"));
  const mapPool =
    preset.forcePools || selectedDifferentPreset || customMapPool.length === 0
      ? preset.mapPool
      : customMapPool;
  const characterPool =
    preset.forcePools || selectedDifferentPreset || customCharacterPool.length === 0
      ? preset.characterPool
      : customCharacterPool;

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        bestOf,
        rulesPreset,
        vetoMode,
        vetoStartingTeam,
        vetoTimerSeconds,
        vetoTimeoutAction,
        characterBanMode,
        characterBanTimerSeconds,
        ...(mapPool.length ? { mapPool } : {}),
        characterPool: characterPool.length ? characterPool : Prisma.JsonNull,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.settings",
        targetType: "match",
        targetId: match.id,
        metadata: {
          publicCode: match.publicCode,
          bestOf,
          rulesPreset,
          vetoMode,
          vetoStartingTeam,
          vetoTimerSeconds,
          vetoTimeoutAction,
          characterBanMode,
          characterBanTimerSeconds,
        },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function submitWebScore(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForAction(code);
  const teamAScore = cleanInt(formData.get("teamAScore"));
  const teamBScore = cleanInt(formData.get("teamBScore"));
  const teamAResult = cleanResultLabel(formData.get("teamAResult"));
  const teamBResult = cleanResultLabel(formData.get("teamBResult"));
  const scoringType = cleanScoreType(formData.get("scoringType"));
  const comment = cleanText(formData.get("comment"));

  await prisma.$transaction(async (tx) => {
    await tx.scoreReport.create({
      data: {
        organizationId: match.organizationId,
        matchId: match.id,
        teamAScore,
        teamBScore,
        teamAResult,
        teamBResult,
        scoringType,
        comment: comment || null,
        status: "approved",
        submittedById: auth.profile.id,
        reviewedById: auth.profile.id,
        reviewedAt: new Date(),
      },
    });

    await tx.match.update({
      where: { id: match.id },
      data: {
        teamAScore,
        teamBScore,
        teamAResult,
        teamBResult,
        status: MatchStatus.LIVE,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.score",
        targetType: "match",
        targetId: match.id,
        metadata: {
          publicCode: match.publicCode,
          teamAScore,
          teamBScore,
          teamAResult,
          teamBResult,
          scoringType,
        },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function updateWebScoreReport(reportId: string, formData: FormData) {
  const report = await prisma.scoreReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      organizationId: true,
      matchId: true,
      scoringType: true,
      match: { select: { publicCode: true } },
    },
  });
  if (!report) throw new Error("Score report not found.");
  const auth = await requireOrgRole(report.organizationId, MANAGER_ROLES);
  await assertNotMatchParticipant(report.matchId, auth.profile.id);

  const teamAScore = cleanInt(formData.get("teamAScore"));
  const teamBScore = cleanInt(formData.get("teamBScore"));
  const teamAResult = cleanResultLabel(formData.get("teamAResult"));
  const teamBResult = cleanResultLabel(formData.get("teamBResult"));
  const scoringType = cleanScoreType(formData.get("scoringType")) || report.scoringType;
  const comment = cleanText(formData.get("comment"));

  await prisma.$transaction(async (tx) => {
    await tx.scoreReport.update({
      where: { id: report.id },
      data: {
        teamAScore,
        teamBScore,
        teamAResult,
        teamBResult,
        scoringType,
        comment: comment || null,
        status: "approved",
        reviewedById: auth.profile.id,
        reviewedAt: new Date(),
        reviewNote: "Corrected from dashboard.",
      },
    });

    await tx.match.update({
      where: { id: report.matchId },
      data: {
        teamAScore,
        teamBScore,
        teamAResult,
        teamBResult,
        status: MatchStatus.LIVE,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: report.organizationId,
        actorId: auth.profile.id,
        action: "web.match.score.correct",
        targetType: "score_report",
        targetId: report.id,
        metadata: {
          publicCode: report.match.publicCode,
          teamAScore,
          teamBScore,
          teamAResult,
          teamBResult,
          scoringType,
        },
      },
    });
  });

  await enqueueDiscordMatchRefresh(report.organizationId, report.matchId);
  revalidatePath(`/matches/${report.match.publicCode}`);
  revalidatePath("/matches");
}

export async function submitWebEvidence(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForAction(code);
  const note = cleanText(formData.get("note"));
  const url = cleanText(formData.get("url"), 1000);
  const uploadedUrl = await saveEvidenceFile(match.id, formData.get("evidence"));
  const finalUrl = uploadedUrl ?? url;

  if (!finalUrl) {
    throw new Error("Add an evidence URL or upload an image.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.evidence.create({
      data: {
        organizationId: match.organizationId,
        matchId: match.id,
        url: finalUrl,
        note: note || null,
        submittedById: auth.profile.id,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.evidence",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode, hasUpload: Boolean(uploadedUrl) },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/evidence");
}

export async function updateWebMatchStatus(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForAction(code);
  const status = cleanStatus(formData.get("status"));
  const reason = cleanText(formData.get("reason"));

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        status,
        disputeReason: status === MatchStatus.DISPUTED ? reason || "Disputed from dashboard" : null,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.status",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode, status, reason },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function startWebVeto(code: string) {
  const { match, auth } = await loadMatchForAction(code);

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.VETO },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.veto.start",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function pauseWebVeto(code: string) {
  const { match, auth } = await loadMatchForAction(code);

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.PENDING, updatedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.veto.pause",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function endWebVeto(code: string) {
  const { match, auth } = await loadMatchForAction(code);
  const pickedMaps = match.vetoActions
    .filter((action) => action.kind === VetoKind.PICK && !action.mapName.startsWith("__"))
    .map((action) => action.mapName);
  const mapPool = normalizeMapPool(match.mapPool);
  const usedMaps = new Set(
    match.vetoActions
      .map((action) => action.mapName)
      .filter((mapName) => !mapName.startsWith("__")),
  );
  const finalMap =
    match.finalMap ??
    (match.vetoMode === "series_picks" || match.vetoMode === "manual_picks"
      ? pickedMaps.at(-1) ?? null
      : mapPool.find((entry) => !usedMaps.has(entry.name))?.name ?? pickedMaps.at(-1) ?? null);

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        finalMap,
        status: MatchStatus.PENDING,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.veto.end",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode, finalMap },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function submitWebVetoAction(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForAction(code);
  const requestedMap = cleanText(formData.get("mapName"), 120);
  const source = cleanActionSource(formData.get("source"));
  const note = cleanText(formData.get("note"), 240);
  if (!requestedMap) throw new Error("Select a map.");

  const mapPool = normalizeMapPool(match.mapPool);
  const selectedMap = mapPool.find(
    (entry) => entry.name.toLowerCase() === requestedMap.toLowerCase(),
  )?.name;
  if (!selectedMap) throw new Error("That map is not in this match map pool.");

  const usedMaps = new Set(
    match.vetoActions
      .map((action) => action.mapName)
      .filter((mapName) => !mapName.startsWith("__")),
  );
  if (usedMaps.has(selectedMap)) {
    throw new Error("That map has already been used in this veto.");
  }

  const next = nextVetoState(match);
  const picks = match.vetoActions.filter((action) => action.kind === VetoKind.PICK);
  const remainingAfterAction = mapPool.filter(
    (entry) => entry.name !== selectedMap && !usedMaps.has(entry.name),
  );
  const isSeriesPick =
    match.vetoMode === "series_picks" || match.vetoMode === "manual_picks";
  const seriesComplete =
    match.vetoMode === "series_picks" &&
    picks.length + 1 >= Math.min(match.bestOf, mapPool.length);
  const finalMap = isSeriesPick
    ? null
    : remainingAfterAction.length <= 1
      ? remainingAfterAction[0]?.name ?? selectedMap
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.vetoAction.create({
      data: {
        matchId: match.id,
        kind: next.kind,
        teamSlot: next.teamSlot,
        mapName: selectedMap,
        source,
        note: note || null,
        actorId: auth.profile.id,
      },
    });

    await tx.match.update({
      where: { id: match.id },
      data: {
        finalMap,
        status:
          finalMap || seriesComplete
            ? MatchStatus.PENDING
            : MatchStatus.VETO,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.veto.action",
        targetType: "match",
        targetId: match.id,
        metadata: {
          publicCode: match.publicCode,
          kind: next.kind,
          teamSlot: next.teamSlot,
          mapName: selectedMap,
          source,
          finalMap,
        },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function submitTeamVetoAction(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForTeamVetoAction(code);
  if (match.status !== MatchStatus.VETO || match.finalMap) {
    throw new Error("This match is not accepting team veto submissions right now.");
  }

  const next = nextVetoState(match);
  const participant = match.participants.find(
    (entry) => entry.slot === next.teamSlot,
  );
  const canSubmitForTurn =
    participant?.team.captainProfileId === auth.profile.id ||
    participant?.team.members.some(
      (member) =>
        member.userProfileId === auth.profile.id &&
        TEAM_VETO_ROLES.has(member.teamRole),
    );

  if (!canSubmitForTurn) {
    throw new Error("Only this team's captain, coach, manager, or team leader can submit this turn.");
  }

  const requestedMap = cleanText(formData.get("mapName"), 120);
  const note = cleanText(formData.get("note"), 240);
  if (!requestedMap) throw new Error("Select a map.");

  const mapPool = normalizeMapPool(match.mapPool);
  const selectedMap = mapPool.find(
    (entry) => entry.name.toLowerCase() === requestedMap.toLowerCase(),
  )?.name;
  if (!selectedMap) throw new Error("That map is not in this match map pool.");

  const usedMaps = new Set(
    match.vetoActions
      .map((action) => action.mapName)
      .filter((mapName) => !mapName.startsWith("__")),
  );
  if (usedMaps.has(selectedMap)) {
    throw new Error("That map has already been used in this veto.");
  }

  const picks = match.vetoActions.filter((action) => action.kind === VetoKind.PICK);
  const remainingAfterAction = mapPool.filter(
    (entry) => entry.name !== selectedMap && !usedMaps.has(entry.name),
  );
  const isSeriesPick =
    match.vetoMode === "series_picks" || match.vetoMode === "manual_picks";
  const seriesComplete =
    match.vetoMode === "series_picks" &&
    picks.length + 1 >= Math.min(match.bestOf, mapPool.length);
  const finalMap = isSeriesPick
    ? null
    : remainingAfterAction.length <= 1
      ? remainingAfterAction[0]?.name ?? selectedMap
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.vetoAction.create({
      data: {
        matchId: match.id,
        kind: next.kind,
        teamSlot: next.teamSlot,
        mapName: selectedMap,
        source: "team",
        note: note || null,
        actorId: auth.profile.id,
      },
    });

    await tx.match.update({
      where: { id: match.id },
      data: {
        finalMap,
        status:
          finalMap || seriesComplete
            ? MatchStatus.PENDING
            : MatchStatus.VETO,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.veto.team_action",
        targetType: "match",
        targetId: match.id,
        metadata: {
          publicCode: match.publicCode,
          kind: next.kind,
          teamSlot: next.teamSlot,
          mapName: selectedMap,
        },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

async function loadMatchForTeamCharacterBanAction(code: string) {
  const auth = await requireUserProfile();
  const match = await prisma.match.findUnique({
    where: { publicCode: code.toUpperCase() },
    select: {
      id: true,
      publicCode: true,
      organizationId: true,
      vetoStartingTeam: true,
      characterBanMode: true,
      characterBanStartedAt: true,
      characterPool: true,
      status: true,
      characterBanActions: {
        orderBy: { createdAt: "asc" },
        select: { teamSlot: true, character: true },
      },
      participants: {
        select: {
          slot: true,
          team: {
            select: {
              captainProfileId: true,
              members: {
                select: { userProfileId: true, teamRole: true },
              },
            },
          },
        },
      },
    },
  });

  if (!match) throw new Error("Match not found.");
  return { match, auth };
}

export async function submitTeamCharacterBanAction(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForTeamCharacterBanAction(code);
  if (match.characterBanMode === "none") {
    throw new Error("Character bans are not enabled for this match.");
  }
  if (!match.characterBanStartedAt) {
    throw new Error("The referee has not started character bans yet.");
  }
  if (
    match.status === MatchStatus.COMPLETE ||
    match.status === MatchStatus.CANCELLED
  ) {
    throw new Error("This match is no longer accepting character bans.");
  }

  const teamSlot = nextCharacterBanState(match);
  const participant = match.participants.find((entry) => entry.slot === teamSlot);
  const canSubmitForTurn =
    participant?.team.captainProfileId === auth.profile.id ||
    participant?.team.members.some(
      (member) =>
        member.userProfileId === auth.profile.id &&
        TEAM_VETO_ROLES.has(member.teamRole),
    );

  if (!canSubmitForTurn) {
    throw new Error(
      "Only this team's captain, coach, manager, or team leader can submit this turn.",
    );
  }

  const character = cleanText(formData.get("character"), 120);
  const action = cleanCharacterAction(formData.get("action"));
  const gameRole = cleanText(formData.get("gameRole"), 80);
  const note = cleanText(formData.get("note"), 240);
  if (!character) throw new Error("Enter a character, champion, hero, or agent.");

  const pool = normalizeMapPool(match.characterPool);
  const selected = pool.length
    ? pool.find((entry) => entry.name.toLowerCase() === character.toLowerCase())?.name
    : character;
  if (!selected) throw new Error("That character is not in this match character pool.");

  const usedCharacters = new Set(
    match.characterBanActions.map((entry) => entry.character.toLowerCase()),
  );
  if (usedCharacters.has(selected.toLowerCase())) {
    throw new Error("That character has already been banned in this match.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.characterBanAction.create({
      data: {
        matchId: match.id,
        teamSlot,
        action,
        character: selected,
        gameRole: gameRole || null,
        source: "team",
        note: note || null,
        actorId: auth.profile.id,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.character_ban.team_action",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode, teamSlot, action, character: selected },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function grantWebVetoExtraTurn(code: string) {
  const { match, auth } = await loadMatchForAction(code);
  const next = nextVetoState(match);

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { updatedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.veto.extra_turn",
        targetType: "match",
        targetId: match.id,
        metadata: {
          publicCode: match.publicCode,
          teamSlot: next.teamSlot,
          kind: next.kind,
          seconds: match.vetoTimerSeconds,
        },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
}

export async function skipWebVetoTurn(code: string) {
  const { match, auth } = await loadMatchForAction(code);
  const next = nextVetoState(match);

  await prisma.$transaction(async (tx) => {
    await tx.vetoAction.create({
      data: {
        matchId: match.id,
        kind: next.kind,
        teamSlot: next.teamSlot,
        mapName: "__TURN_SKIPPED__",
        source: "timeout_skip",
        note: "Turn skipped by referee.",
        actorId: auth.profile.id,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.veto.skip",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode, teamSlot: next.teamSlot, kind: next.kind },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function restartWebVetoFromPoint(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForAction(code);
  const rollbackPoint = cleanText(formData.get("rollbackPoint"), 80);
  const keepThroughIndex =
    rollbackPoint === "start"
      ? -1
      : match.vetoActions.findIndex((action) => action.id === rollbackPoint);

  if (rollbackPoint !== "start" && keepThroughIndex < 0) {
    throw new Error("Choose a valid veto restart point.");
  }

  const actionsToDelete = match.vetoActions.slice(keepThroughIndex + 1);

  await prisma.$transaction(async (tx) => {
    if (actionsToDelete.length) {
      await tx.vetoAction.deleteMany({
        where: {
          matchId: match.id,
          id: { in: actionsToDelete.map((action) => action.id) },
        },
      });
    }

    await tx.match.update({
      where: { id: match.id },
      data: {
        finalMap: null,
        status: MatchStatus.VETO,
        updatedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.veto.rollback",
        targetType: "match",
        targetId: match.id,
        metadata: {
          publicCode: match.publicCode,
          rollbackPoint,
          keptTurns: keepThroughIndex + 1,
          deletedTurns: actionsToDelete.length,
        },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

function cleanMapIndex(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Invalid map.");
  }
  return parsed;
}

function seriesScoreFromMaps(
  maps: Array<{
    teamAScore: number;
    teamBScore: number;
    teamAResult?: string | null;
    teamBResult?: string | null;
    status: string;
  }>,
) {
  let teamAScore = 0;
  let teamBScore = 0;
  for (const map of maps) {
    if (map.status !== "complete") continue;
    if (
      map.teamAResult === "W" ||
      ["DQ", "FT", "FF", "L"].includes(map.teamBResult ?? "")
    ) {
      teamAScore += 1;
      continue;
    }
    if (
      map.teamBResult === "W" ||
      ["DQ", "FT", "FF", "L"].includes(map.teamAResult ?? "")
    ) {
      teamBScore += 1;
      continue;
    }
    if (map.teamAResult === "NC" || map.teamBResult === "NC") continue;
    if (map.teamAScore > map.teamBScore) teamAScore += 1;
    else if (map.teamBScore > map.teamAScore) teamBScore += 1;
  }
  return { teamAScore, teamBScore };
}

async function loadMatchForMapAction(code: string) {
  const match = await prisma.match.findUnique({
    where: { publicCode: code.toUpperCase() },
    select: {
      id: true,
      publicCode: true,
      organizationId: true,
      status: true,
      bestOf: true,
      mapPool: true,
      finalMap: true,
      vetoActions: {
        orderBy: { createdAt: "asc" },
        select: { kind: true, mapName: true },
      },
      mapResults: {
        orderBy: { mapIndex: "asc" },
        select: {
          id: true,
          mapIndex: true,
          mapName: true,
          teamAScore: true,
          teamBScore: true,
          teamAResult: true,
          teamBResult: true,
          status: true,
        },
      },
    },
  });

  if (!match) throw new Error("Match not found.");
  const auth = await requireOrgRole(match.organizationId, MANAGER_ROLES);
  await assertNotMatchParticipant(match.id, auth.profile.id);
  return { match, auth };
}

export async function startWebMatch(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForMapAction(code);
  const requestedMap = cleanText(formData.get("mapName"), 120);
  if (!requestedMap) throw new Error("Select the map to start.");

  const mapPool = normalizeMapPool(match.mapPool);
  const selectedMap =
    mapPool.find((entry) => entry.name.toLowerCase() === requestedMap.toLowerCase())
      ?.name ?? requestedMap;

  const nextIndex = match.mapResults.length;

  await prisma.$transaction(async (tx) => {
    await tx.mapResult.create({
      data: {
        matchId: match.id,
        mapIndex: nextIndex,
        mapName: selectedMap,
        status: "pending",
        actorId: auth.profile.id,
      },
    });

    await tx.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.LIVE, finalMap: selectedMap },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.map.start",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode, mapIndex: nextIndex, mapName: selectedMap },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function submitWebMapScore(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForMapAction(code);
  const mapIndex = cleanMapIndex(formData.get("mapIndex"));
  const teamAScore = cleanInt(formData.get("teamAScore"));
  const teamBScore = cleanInt(formData.get("teamBScore"));
  const teamAResult = cleanResultLabel(formData.get("teamAResult"));
  const teamBResult = cleanResultLabel(formData.get("teamBResult"));
  const note = cleanText(formData.get("note"), 240);

  const target = match.mapResults.find((entry) => entry.mapIndex === mapIndex);
  if (!target) throw new Error("That map has not been started yet.");

  const status = teamAResult || teamBResult || teamAScore !== teamBScore ? "complete" : "draw";

  // Recompute the series score from every map (with this map's new numbers).
  const updatedMaps = match.mapResults.map((entry) =>
    entry.mapIndex === mapIndex
      ? { ...entry, teamAScore, teamBScore, teamAResult, teamBResult, status }
      : entry,
  );
  const series = seriesScoreFromMaps(updatedMaps);

  await prisma.$transaction(async (tx) => {
    await tx.mapResult.update({
      where: { id: target.id },
      data: {
        teamAScore,
        teamBScore,
        teamAResult,
        teamBResult,
        status,
        note: note || null,
        actorId: auth.profile.id,
      },
    });

    await tx.match.update({
      where: { id: match.id },
      data: {
        teamAScore: series.teamAScore,
        teamBScore: series.teamBScore,
        teamAResult: null,
        teamBResult: null,
        status: MatchStatus.LIVE,
      },
    });

    await tx.scoreReport.create({
      data: {
        organizationId: match.organizationId,
        matchId: match.id,
        teamAScore,
        teamBScore,
        teamAResult,
        teamBResult,
        scoringType: "map",
        comment: `Map ${mapIndex + 1} (${target.mapName})${note ? ` - ${note}` : ""}`,
        status: "approved",
        submittedById: auth.profile.id,
        reviewedById: auth.profile.id,
        reviewedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.map.score",
        targetType: "match",
        targetId: match.id,
        metadata: {
          publicCode: match.publicCode,
          mapIndex,
          mapName: target.mapName,
          teamAScore,
          teamBScore,
          teamAResult,
          teamBResult,
          status,
          seriesScore: series,
        },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function addExtraMapVeto(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForMapAction(code);
  const requestedMap = cleanText(formData.get("mapName"), 120);
  if (!requestedMap) throw new Error("Select the extra map to play.");

  const lastMap = match.mapResults.at(-1);
  if (!lastMap || lastMap.status !== "draw") {
    throw new Error("An extra map veto is only available after a drawn map.");
  }

  const mapPool = normalizeMapPool(match.mapPool);
  const selectedMap = mapPool.find(
    (entry) => entry.name.toLowerCase() === requestedMap.toLowerCase(),
  )?.name;
  if (!selectedMap) throw new Error("That map is not in this match map pool.");

  const playedMaps = new Set(match.mapResults.map((entry) => entry.mapName));
  if (playedMaps.has(selectedMap)) {
    throw new Error("That map has already been played in this match.");
  }

  const nextIndex = match.mapResults.length;
  const startingTeam = "teamA";

  await prisma.$transaction(async (tx) => {
    await tx.vetoAction.create({
      data: {
        matchId: match.id,
        kind: VetoKind.PICK,
        teamSlot: startingTeam,
        mapName: selectedMap,
        source: "referee_choice",
        note: "Extra map veto after a draw.",
        actorId: auth.profile.id,
      },
    });

    await tx.mapResult.create({
      data: {
        matchId: match.id,
        mapIndex: nextIndex,
        mapName: selectedMap,
        status: "pending",
        actorId: auth.profile.id,
      },
    });

    await tx.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.LIVE, finalMap: selectedMap },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.map.extra_veto",
        targetType: "match",
        targetId: match.id,
        metadata: {
          publicCode: match.publicCode,
          mapIndex: nextIndex,
          mapName: selectedMap,
          afterDrawIndex: lastMap.mapIndex,
        },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function submitWebCharacterBanAction(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForAction(code);
  if (match.characterBanMode === "none") {
    throw new Error("Character bans are not enabled for this match.");
  }

  const character = cleanText(formData.get("character"), 120);
  const action = cleanCharacterAction(formData.get("action"));
  const gameRole = cleanText(formData.get("gameRole"), 80);
  const source = cleanActionSource(formData.get("source"));
  const note = cleanText(formData.get("note"), 240);
  if (!character) throw new Error("Enter a character, champion, hero, or agent.");

  const pool = normalizeMapPool(match.characterPool);
  const selected = pool.length
    ? pool.find((entry) => entry.name.toLowerCase() === character.toLowerCase())?.name
    : character;
  if (!selected) throw new Error("That character is not in this match character pool.");

  const usedCharacters = new Set(
    match.characterBanActions.map((action) => action.character.toLowerCase()),
  );
  if (usedCharacters.has(selected.toLowerCase())) {
    throw new Error("That character has already been banned in this match.");
  }

  const teamSlot = nextCharacterBanState(match);

  await prisma.$transaction(async (tx) => {
    await tx.characterBanAction.create({
      data: {
        matchId: match.id,
        teamSlot,
        action,
        character: selected,
        gameRole: gameRole || null,
        source,
        note: note || null,
        actorId: auth.profile.id,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.character_ban",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode, teamSlot, action, character: selected, gameRole, source },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function startWebCharacterBans(code: string) {
  const { match, auth } = await loadMatchForAction(code);
  if (match.characterBanMode === "none") {
    throw new Error("Character bans are not enabled for this match.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { characterBanStartedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.character_ban.start",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function endWebCharacterBans(code: string) {
  const { match, auth } = await loadMatchForAction(code);

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { characterBanStartedAt: null },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.character_ban.end",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function updateWebRefereeClaimSettings(code: string, formData: FormData) {
  const match = await prisma.match.findUnique({
    where: { publicCode: code.toUpperCase() },
    select: {
      id: true,
      publicCode: true,
      organizationId: true,
      refereeClaimMode: true,
      refereeClaimLimit: true,
    },
  });
  if (!match) throw new Error("Match not found.");

  const auth = await requireOrgRole(
    match.organizationId,
    REFEREE_ASSIGNMENT_MANAGER_ROLES,
  );
  await assertNotMatchParticipant(match.id, auth.profile.id);

  const refereeClaimMode = cleanClaimMode(formData.get("refereeClaimMode"));
  const refereeClaimLimit = cleanClaimLimit(
    formData.get("refereeClaimLimit"),
    match.refereeClaimLimit,
  );

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { refereeClaimMode, refereeClaimLimit },
    });
    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.referee_claim_settings",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode, refereeClaimMode, refereeClaimLimit },
      },
    });
  });

  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/todo");
}

export async function claimWebRefereeAssignment(code: string) {
  const auth = await requireUserProfile();
  const match = await prisma.match.findUnique({
    where: { publicCode: code.toUpperCase() },
    select: {
      id: true,
      publicCode: true,
      organizationId: true,
    },
  });
  if (!match) throw new Error("Match not found.");

  await requireOrgRole(match.organizationId, MANAGER_ROLES);
  await assertNotMatchParticipant(match.id, auth.profile.id);

  try {
    await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id" FROM "Match" WHERE "id" = ${match.id} FOR UPDATE
        `;

        const freshMatch = await tx.match.findUnique({
          where: { id: match.id },
          select: {
            id: true,
            organizationId: true,
            publicCode: true,
            refereeClaimMode: true,
            refereeClaimLimit: true,
            tournament: {
              select: { refereeClaimMode: true, refereeClaimLimit: true },
            },
            refereeAssignments: {
              where: { status: "active" },
              select: { id: true, userProfileId: true },
            },
          },
        });
        if (!freshMatch) throw new Error("Match not found.");

        if (
          freshMatch.refereeAssignments.some(
            (assignment) => assignment.userProfileId === auth.profile.id,
          )
        ) {
          throw new Error("You are already assigned to this match.");
        }

        const mode = effectiveClaimMode(freshMatch);
        const limit = effectiveClaimLimit(freshMatch);
        if (mode !== "open") {
          throw new Error("This match is not open for referee claims.");
        }
        if (freshMatch.refereeAssignments.length >= limit) {
          throw new Error("All referee claim slots are already filled.");
        }

        await tx.matchRefereeAssignment.create({
          data: {
            matchId: freshMatch.id,
            userProfileId: auth.profile.id,
            source: "claimed",
            status: "active",
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId: freshMatch.organizationId,
            actorId: auth.profile.id,
            action: "web.match.referee.claim",
            targetType: "match",
            targetId: freshMatch.id,
            metadata: { publicCode: freshMatch.publicCode, limit },
          },
        });
      });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error(
        "A referee slot changed while you were claiming it. Refresh and try again.",
      );
    }
    throw error;
  }

  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/todo");
}

export async function assignWebReferee(code: string, formData: FormData) {
  const userProfileId = cleanText(formData.get("userProfileId"), 80);
  if (!userProfileId) throw new Error("Choose a referee.");

  const match = await prisma.match.findUnique({
    where: { publicCode: code.toUpperCase() },
    select: {
      id: true,
      publicCode: true,
      organizationId: true,
      refereeClaimMode: true,
      refereeClaimLimit: true,
      tournament: {
        select: { refereeClaimMode: true, refereeClaimLimit: true },
      },
      refereeAssignments: {
        where: { status: "active" },
        select: { id: true, userProfileId: true },
      },
    },
  });
  if (!match) throw new Error("Match not found.");

  const auth = await requireOrgRole(
    match.organizationId,
    REFEREE_ASSIGNMENT_MANAGER_ROLES,
  );
  await assertNotMatchParticipant(match.id, auth.profile.id);

  const targetMember = await prisma.orgMember.findUnique({
    where: {
      organizationId_userProfileId: {
        organizationId: match.organizationId,
        userProfileId,
      },
    },
    select: { role: true },
  });
  if (!targetMember || !REFEREE_ASSIGNABLE_ROLES.has(targetMember.role)) {
    throw new Error("Choose an operator/referee from this organization.");
  }
  if (await isProfileMatchParticipant(match.id, userProfileId)) {
    throw new Error("That person is on a team in this match and cannot be assigned as referee.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id" FROM "Match" WHERE "id" = ${match.id} FOR UPDATE
    `;

    const freshMatch = await tx.match.findUnique({
      where: { id: match.id },
      select: {
        id: true,
        publicCode: true,
        organizationId: true,
        refereeClaimMode: true,
        refereeClaimLimit: true,
        tournament: {
          select: { refereeClaimMode: true, refereeClaimLimit: true },
        },
        refereeAssignments: {
          where: { status: "active" },
          select: { id: true, userProfileId: true },
        },
      },
    });
    if (!freshMatch) throw new Error("Match not found.");

    const alreadyAssigned = freshMatch.refereeAssignments.some(
      (assignment) => assignment.userProfileId === userProfileId,
    );
    const limit = effectiveClaimLimit(freshMatch);
    if (!alreadyAssigned && freshMatch.refereeAssignments.length >= limit) {
      throw new Error("Increase the referee limit before assigning another referee.");
    }

    await tx.matchRefereeAssignment.upsert({
      where: {
        matchId_userProfileId: {
          matchId: freshMatch.id,
          userProfileId,
        },
      },
      update: {
        source: "assigned",
        status: "active",
        assignedById: auth.profile.id,
      },
      create: {
        matchId: freshMatch.id,
        userProfileId,
        source: "assigned",
        status: "active",
        assignedById: auth.profile.id,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: freshMatch.organizationId,
        actorId: auth.profile.id,
        action: "web.match.referee.assign",
        targetType: "match",
        targetId: freshMatch.id,
        metadata: { publicCode: freshMatch.publicCode, userProfileId, limit },
      },
    });
  });

  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/todo");
}

export async function removeWebRefereeAssignment(formData: FormData) {
  const assignmentId = cleanText(formData.get("assignmentId"), 80);
  if (!assignmentId) throw new Error("Assignment is required.");

  const assignment = await prisma.matchRefereeAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      userProfileId: true,
      matchId: true,
      match: {
        select: {
          publicCode: true,
          organizationId: true,
        },
      },
    },
  });
  if (!assignment) return;

  const auth = await requireOrgRole(
    assignment.match.organizationId,
    REFEREE_ASSIGNMENT_MANAGER_ROLES,
  );
  await assertNotMatchParticipant(assignment.matchId, auth.profile.id);

  await prisma.$transaction(async (tx) => {
    await tx.matchRefereeAssignment.delete({ where: { id: assignment.id } });
    await tx.auditLog.create({
      data: {
        organizationId: assignment.match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.referee.unassign",
        targetType: "match",
        targetId: assignment.matchId,
        metadata: {
          publicCode: assignment.match.publicCode,
          userProfileId: assignment.userProfileId,
        },
      },
    });
  });

  revalidatePath(`/matches/${assignment.match.publicCode}`);
  revalidatePath("/todo");
}
