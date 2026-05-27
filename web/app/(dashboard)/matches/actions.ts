"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, requireOrgRole } from "@/lib/web-authz";

const DEFAULT_MAPS = ["Ascent", "Bind", "Haven", "Icebox", "Lotus", "Split", "Sunset"];
const PRESET_MAPS: Record<string, string[]> = {
  generic: DEFAULT_MAPS,
  valorant: ["Pearl", "Bind", "Corrode", "Haven", "Abyss", "Split", "Sunset"],
  overwatch: [
    "Busan",
    "Lijiang Tower",
    "Oasis",
    "Blizzard World",
    "Eichenwalde",
    "Midtown",
    "Aatlis",
    "New Junk City",
    "Colosseo",
    "Esperanca",
    "Circuit Royale",
    "Shambali Monastery",
    "Watchpoint: Gibraltar",
  ],
  r6s: ["Border", "Bank", "Clubhouse", "Chalet", "Lair", "Kafe Dostoyevsky", "Skyscraper"],
  cod: ["Hardpoint", "Search & Destroy", "Control"],
  rocket_league: ["Game 1", "Game 2", "Game 3", "Game 4", "Game 5", "Game 6", "Game 7"],
};

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

function parseMapPool(raw: string, rulesPreset: string) {
  const maps = raw
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return maps.length ? maps : PRESET_MAPS[rulesPreset] ?? DEFAULT_MAPS;
}

export async function createWebMatch(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) throw new Error("Organization is required.");

  const auth = await requireOrgRole(organizationId, MANAGER_ROLES);
  const teamAName = cleanText(formData.get("teamAName"));
  const teamBName = cleanText(formData.get("teamBName"));
  const bestOf = cleanBestOf(formData.get("bestOf"));
  const rulesPreset = cleanText(formData.get("rulesPreset"), 40) || "generic";
  const vetoMode = cleanText(formData.get("vetoMode"), 40) || "series_picks";
  const mapPool = parseMapPool(cleanText(formData.get("mapPool"), 2000), rulesPreset);

  if (!teamAName || !teamBName) {
    throw new Error("Both team names are required.");
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
        mapPool,
        allowPlayerReports: formData.get("allowPlayerReports") === "on",
      },
      select: { id: true, publicCode: true },
    });

    await tx.auditLog.create({
      data: {
          organizationId,
          actorId: auth.profile.id,
          action: "web.match.create",
          targetType: "match",
          targetId: created.id,
          metadata: { publicCode: created.publicCode, teamAName, teamBName, bestOf, rulesPreset },
        },
      });

    return created;
  });

  revalidatePath("/matches");
  redirect(`/matches/${match.publicCode}`);
}
