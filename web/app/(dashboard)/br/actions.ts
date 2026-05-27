"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, requireOrgRole } from "@/lib/web-authz";

const DEFAULT_PLACEMENT_POINTS = [12, 9, 7, 5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];

function makeLobbyCode() {
  return `BR${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

function cleanText(value: FormDataEntryValue | null, max = 80) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanInt(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseTeams(raw: string) {
  const seen = new Set<string>();
  return raw
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
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

export async function createWebBrLobby(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) throw new Error("Organization is required.");

  const auth = await requireOrgRole(organizationId, MANAGER_ROLES);
  const teams = parseTeams(cleanText(formData.get("teams"), 3000));
  if (teams.length < 2) throw new Error("Add at least two teams.");

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
        placementPoints: parsePlacementPoints(cleanText(formData.get("placementPoints"), 1000)),
        teams: {
          create: teams.map((name, index) => ({ name, seed: index + 1 })),
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
        metadata: { publicCode: created.publicCode, teams: teams.length },
      },
    });

    return created;
  });

  revalidatePath("/br");
  redirect(`/br/${lobby.publicCode}`);
}
