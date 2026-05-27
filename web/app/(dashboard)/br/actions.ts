"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { MatchStatus } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  enqueueDiscordBrRefresh,
  MANAGER_ROLES,
  requireOrgRole,
} from "@/lib/web-authz";

const DEFAULT_PLACEMENT_POINTS = [
  12, 9, 7, 5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0,
];
const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
const EVIDENCE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function makeLobbyCode() {
  return `BR${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

function cleanText(value: FormDataEntryValue | null, max = 80) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanInt(
  value: FormDataEntryValue | null,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function cleanRequiredInt(
  value: FormDataEntryValue | null,
  label: string,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return parsed;
}

function cleanSignedInt(
  value: FormDataEntryValue | null,
  fallback = 0,
  min = -200,
  max = 200,
) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function cleanOptionalGameNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return cleanRequiredInt(raw, "Game number", 1, 100);
}

function parseTeams(raw: string) {
  return raw
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function uniqueFormIds(formData: FormData, key: string) {
  const seen = new Set<string>();
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function parsePlacementPoints(raw: string) {
  const values = raw
    .split(/[\n,\s]+/)
    .map((entry) => Number(entry.trim()))
    .filter((value) => Number.isFinite(value));
  return values.length ? values : DEFAULT_PLACEMENT_POINTS;
}

function placementPointsFromJson(value: unknown) {
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    ? value.map((entry) => Number(entry))
    : DEFAULT_PLACEMENT_POINTS;
}

function pointsForPlacement(
  placement: number,
  kills: number,
  placementPoints: number[],
  killPoints: number,
) {
  const placementScore =
    placement >= 1 && placement <= placementPoints.length
      ? placementPoints[placement - 1]
      : 0;
  return placementScore + kills * killPoints;
}

function parseResultLines(raw: string, teamIdsByName: Map<string, string>) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error("Add at least one team result.");

  return lines.map((line, index) => {
    const parts = line.split(/\s+/);
    const kills = Number.parseInt(parts.at(-1) ?? "", 10);
    const placement = Number.parseInt(parts.at(-2) ?? "", 10);
    const name = parts.slice(0, -2).join(" ").trim();

    if (!name || !Number.isFinite(placement) || !Number.isFinite(kills)) {
      throw new Error(`Line ${index + 1} must be: Team Name placement kills.`);
    }

    const brTeamId = teamIdsByName.get(name.toLowerCase());
    if (!brTeamId) {
      throw new Error(`Unknown BR team on line ${index + 1}: ${name}.`);
    }

    return { brTeamId, name, placement, kills };
  });
}

function cleanBrLogKind(value: FormDataEntryValue | null) {
  const kind = String(value ?? "note");
  return ["pause", "warning", "evidence", "note", "dispute"].includes(kind)
    ? kind
    : "note";
}

function cleanBrStatus(value: FormDataEntryValue | null) {
  const status = String(value ?? "").toUpperCase();
  if (
    status === MatchStatus.PENDING ||
    status === MatchStatus.LIVE ||
    status === MatchStatus.DISPUTED ||
    status === MatchStatus.COMPLETE ||
    status === MatchStatus.CANCELLED
  ) {
    return status;
  }
  throw new Error("Invalid BR lobby status.");
}

async function loadBrLobbyForAction(code: string) {
  const lobby = await prisma.brLobby.findUnique({
    where: { publicCode: code.toUpperCase() },
    include: { teams: { orderBy: { seed: "asc" } } },
  });

  if (!lobby) throw new Error("BR lobby not found.");
  const auth = await requireOrgRole(lobby.organizationId, MANAGER_ROLES);
  return { lobby, auth };
}

async function saveBrEvidenceFile(lobbyId: string, value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null;

  const extension = EVIDENCE_TYPES[value.type];
  if (!extension) throw new Error("Evidence upload must be a PNG, JPG, or WebP image.");
  if (value.size > MAX_EVIDENCE_BYTES) {
    throw new Error("Evidence upload must be 8 MB or smaller.");
  }

  const bytes = Buffer.from(await value.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", "uploads", "br-evidence");
  await mkdir(uploadDir, { recursive: true });
  const filename = `${lobbyId}-${Date.now()}.${extension}`;
  await writeFile(path.join(uploadDir, filename), bytes);
  return `/uploads/br-evidence/${filename}`;
}

export async function createWebBrLobby(formData: FormData) {
  const lobby = await createWebBrLobbyRecord(formData);
  redirect(`/br/${lobby.publicCode}`);
}

export type CreateWebBrLobbyState = {
  error?: string;
};

function createLobbyError(error: unknown) {
  return error instanceof Error ? error.message : "Could not create BR lobby.";
}

async function createWebBrLobbyRecord(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) throw new Error("Organization is required.");

  const auth = await requireOrgRole(organizationId, MANAGER_ROLES);
  const selectedTeamIds = uniqueFormIds(formData, "teamIds");
  const selectedTeams = selectedTeamIds.length
    ? await prisma.team.findMany({
        where: { organizationId, id: { in: selectedTeamIds } },
        select: { id: true, name: true },
      })
    : [];
  if (selectedTeams.length !== selectedTeamIds.length) {
    throw new Error("One or more selected teams are not in this organization.");
  }
  const selectedTeamsById = new Map(selectedTeams.map((team) => [team.id, team]));
  const teamSeeds: { name: string; linkedTeamId?: string }[] = [];
  const seenNames = new Set<string>();
  const duplicateNames = new Set<string>();

  for (const id of selectedTeamIds) {
    const team = selectedTeamsById.get(id);
    if (!team) continue;
    const key = team.name.toLowerCase();
    if (seenNames.has(key)) {
      duplicateNames.add(team.name);
      continue;
    }
    seenNames.add(key);
    teamSeeds.push({ name: team.name, linkedTeamId: team.id });
  }

  for (const name of parseTeams(cleanText(formData.get("teams"), 3000))) {
    const key = name.toLowerCase();
    if (seenNames.has(key)) {
      duplicateNames.add(name);
      continue;
    }
    seenNames.add(key);
    teamSeeds.push({ name });
  }

  if (duplicateNames.size) {
    throw new Error(
      `Duplicate team name${duplicateNames.size === 1 ? "" : "s"}: ${[
        ...duplicateNames,
      ].join(", ")}.`,
    );
  }
  if (teamSeeds.length < 2) throw new Error("Select or enter at least two teams.");

  const lobby = await prisma.$transaction(async (tx) => {
    const created = await tx.brLobby.create({
      data: {
        publicCode: makeLobbyCode(),
        organizationId,
        createdById: auth.profile.id,
        name: cleanText(formData.get("name")) || "BR Lobby",
        game: cleanText(formData.get("game")) || "Apex Legends",
        gamesPlanned: cleanInt(formData.get("gamesPlanned"), 6, 1, 50),
        killPoints: cleanInt(formData.get("killPoints"), 1, 0, 20),
        placementPoints: parsePlacementPoints(
          cleanText(formData.get("placementPoints"), 1000),
        ),
        teams: {
          create: teamSeeds.map((team, index) => ({
            name: team.name,
            linkedTeamId: team.linkedTeamId,
            seed: index + 1,
          })),
        },
      },
      select: { id: true, publicCode: true, name: true },
    });

    await tx.auditLog.create({
      data: {
        organizationId,
        actorId: auth.profile.id,
        action: "web.br.create",
        targetType: "br_lobby",
        targetId: created.id,
        metadata: {
          publicCode: created.publicCode,
          teams: teamSeeds.length,
          linkedTeams: teamSeeds.filter((team) => team.linkedTeamId).length,
        },
      },
    });

    return created;
  });

  revalidatePath("/br");
  return lobby;
}

export async function createWebBrLobbyWithState(
  _state: CreateWebBrLobbyState,
  formData: FormData,
): Promise<CreateWebBrLobbyState> {
  let lobby: { publicCode: string };
  try {
    lobby = await createWebBrLobbyRecord(formData);
  } catch (error) {
    return { error: createLobbyError(error) };
  }

  redirect(`/br/${lobby.publicCode}`);
}

export async function submitWebBrResults(code: string, formData: FormData) {
  const { lobby, auth } = await loadBrLobbyForAction(code);
  const gameNumber = cleanRequiredInt(
    formData.get("gameNumber"),
    "Game number",
    1,
    100,
  );
  const teamIdsByName = new Map(
    lobby.teams.map((team) => [team.name.toLowerCase(), team.id]),
  );
  const entries = parseResultLines(cleanText(formData.get("results"), 6000), teamIdsByName);
  const placementPoints = placementPointsFromJson(lobby.placementPoints);

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const points = pointsForPlacement(
        entry.placement,
        entry.kills,
        placementPoints,
        lobby.killPoints,
      );
      await tx.brGameResult.upsert({
        where: {
          lobbyId_brTeamId_gameNumber: {
            lobbyId: lobby.id,
            brTeamId: entry.brTeamId,
            gameNumber,
          },
        },
        update: {
          placement: entry.placement,
          kills: entry.kills,
          points,
          actorId: auth.profile.id,
        },
        create: {
          lobbyId: lobby.id,
          brTeamId: entry.brTeamId,
          gameNumber,
          placement: entry.placement,
          kills: entry.kills,
          points,
          actorId: auth.profile.id,
        },
      });
    }

    await tx.brLobby.update({
      where: { id: lobby.id },
      data: { status: MatchStatus.LIVE },
    });

    await tx.auditLog.create({
      data: {
        organizationId: lobby.organizationId,
        actorId: auth.profile.id,
        action: "web.br.result",
        targetType: "br_lobby",
        targetId: lobby.id,
        metadata: { publicCode: lobby.publicCode, gameNumber, teams: entries.length },
      },
    });
  });

  await enqueueDiscordBrRefresh(lobby.organizationId, lobby.id);
  revalidatePath(`/br/${lobby.publicCode}`);
  revalidatePath("/br");
}

export type BrActionState = {
  error?: string;
  success?: string;
};

function brActionError(error: unknown) {
  return error instanceof Error ? error.message : "Action could not be saved.";
}

export async function submitWebBrResultsWithState(
  code: string,
  _state: BrActionState,
  formData: FormData,
): Promise<BrActionState> {
  try {
    await submitWebBrResults(code, formData);
    return { success: "Game results saved." };
  } catch (error) {
    return { error: brActionError(error) };
  }
}

export async function submitWebBrAdjustment(code: string, formData: FormData) {
  const { lobby, auth } = await loadBrLobbyForAction(code);
  const brTeamId = String(formData.get("brTeamId") ?? "");
  const reason = cleanText(formData.get("reason"));
  const team = lobby.teams.find((entry) => entry.id === brTeamId);
  if (!team) throw new Error("Select a BR team.");
  if (!reason) throw new Error("Adjustment reason is required.");

  const points = cleanSignedInt(formData.get("points"));
  const kills = cleanSignedInt(formData.get("kills"));
  const gameNumber = cleanOptionalGameNumber(formData.get("gameNumber"));

  await prisma.$transaction(async (tx) => {
    await tx.brAdjustment.create({
      data: {
        lobbyId: lobby.id,
        brTeamId,
        points,
        kills,
        gameNumber,
        reason,
        actorId: auth.profile.id,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: lobby.organizationId,
        actorId: auth.profile.id,
        action: "web.br.adjustment",
        targetType: "br_lobby",
        targetId: lobby.id,
        metadata: { publicCode: lobby.publicCode, team: team.name, points, kills },
      },
    });
  });

  await enqueueDiscordBrRefresh(lobby.organizationId, lobby.id);
  revalidatePath(`/br/${lobby.publicCode}`);
}

export async function submitWebBrAdjustmentWithState(
  code: string,
  _state: BrActionState,
  formData: FormData,
): Promise<BrActionState> {
  try {
    await submitWebBrAdjustment(code, formData);
    return { success: "Adjustment saved." };
  } catch (error) {
    return { error: brActionError(error) };
  }
}

export async function submitWebBrLog(code: string, formData: FormData) {
  const { lobby, auth } = await loadBrLobbyForAction(code);
  const kind = cleanBrLogKind(formData.get("kind"));
  const brTeamId = String(formData.get("brTeamId") ?? "") || null;
  const team = brTeamId ? lobby.teams.find((entry) => entry.id === brTeamId) : null;
  if (brTeamId && !team) throw new Error("Select a valid BR team.");

  const subject = cleanText(formData.get("subject"));
  const summary = cleanText(formData.get("summary"));
  const details = cleanText(formData.get("details"), 1000);
  const rule = cleanText(formData.get("rule"));
  const gameNumber = cleanOptionalGameNumber(formData.get("gameNumber"));
  const durationMinutes = cleanInt(formData.get("durationMinutes"), 0, 0, 600);
  const uploadedUrl = await saveBrEvidenceFile(lobby.id, formData.get("evidence"));
  const attachmentUrl = uploadedUrl ?? cleanText(formData.get("attachmentUrl"), 1000);

  if (!summary && !details && !attachmentUrl) {
    throw new Error("Add a summary, details, or evidence attachment.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.brLog.create({
      data: {
        lobbyId: lobby.id,
        kind,
        brTeamId,
        subject: subject || null,
        gameNumber,
        summary: summary || null,
        details: details || null,
        rule: rule || null,
        durationMinutes: durationMinutes || null,
        attachmentUrl: attachmentUrl || null,
        attachmentName: uploadedUrl ? "uploaded evidence" : null,
        actorId: auth.profile.id,
      },
    });

    if (kind === "dispute") {
      await tx.brLobby.update({
        where: { id: lobby.id },
        data: { status: MatchStatus.DISPUTED },
      });
    }

    await tx.auditLog.create({
      data: {
        organizationId: lobby.organizationId,
        actorId: auth.profile.id,
        action: `web.br.${kind}`,
        targetType: "br_lobby",
        targetId: lobby.id,
        metadata: { publicCode: lobby.publicCode, team: team?.name, gameNumber },
      },
    });
  });

  await enqueueDiscordBrRefresh(lobby.organizationId, lobby.id);
  revalidatePath(`/br/${lobby.publicCode}`);
}

export async function submitWebBrLogWithState(
  code: string,
  _state: BrActionState,
  formData: FormData,
): Promise<BrActionState> {
  try {
    await submitWebBrLog(code, formData);
    return { success: "Referee log saved." };
  } catch (error) {
    return { error: brActionError(error) };
  }
}

export async function updateWebBrStatus(code: string, formData: FormData) {
  const { lobby, auth } = await loadBrLobbyForAction(code);
  const status = cleanBrStatus(formData.get("status"));
  const reason = cleanText(formData.get("reason"));

  await prisma.$transaction(async (tx) => {
    await tx.brLobby.update({
      where: { id: lobby.id },
      data: { status },
    });

    if (reason) {
      await tx.brLog.create({
        data: {
          lobbyId: lobby.id,
          kind: status === MatchStatus.DISPUTED ? "dispute" : "note",
          summary: `Status changed to ${status.toLowerCase()}`,
          details: reason,
          actorId: auth.profile.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        organizationId: lobby.organizationId,
        actorId: auth.profile.id,
        action: "web.br.status",
        targetType: "br_lobby",
        targetId: lobby.id,
        metadata: { publicCode: lobby.publicCode, status, reason },
      },
    });
  });

  await enqueueDiscordBrRefresh(lobby.organizationId, lobby.id);
  revalidatePath(`/br/${lobby.publicCode}`);
  revalidatePath("/br");
}

export async function updateWebBrStatusWithState(
  code: string,
  _state: BrActionState,
  formData: FormData,
): Promise<BrActionState> {
  try {
    await updateWebBrStatus(code, formData);
    return { success: "Lobby status updated." };
  } catch (error) {
    return { error: brActionError(error) };
  }
}
