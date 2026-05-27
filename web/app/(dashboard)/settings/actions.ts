"use server";

import { revalidatePath } from "next/cache";

import { getLinkedDiscordId, getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

function cleanText(value: FormDataEntryValue | null, max = 80) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanCode(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
}

function cleanMulti(formData: FormData, key: string, allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  return formData
    .getAll(key)
    .map((value) => String(value))
    .filter((value) => allowedSet.has(value));
}

export const GAME_OPTIONS = [
  "Apex Legends",
  "Call of Duty",
  "Counter-Strike 2",
  "Dota 2",
  "EA FC",
  "Fortnite",
  "League of Legends",
  "Overwatch 2",
  "PUBG Mobile",
  "Rainbow Six Siege",
  "Rocket League",
  "Valorant",
] as const;

export const FIELD_ROLE_OPTIONS = [
  "Tournament admin",
  "Head referee",
  "Match referee",
  "BR lobby referee",
  "Rules judge",
  "Observer",
  "Broadcast ops",
  "Tech support",
  "Coach",
  "Player",
] as const;

export async function updateUserSettings(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("You must be signed in.");

  const displayName = cleanText(formData.get("displayName"));
  const countryCode = cleanCode(formData.get("countryCode"));
  const gameExperiences = cleanMulti(formData, "gameExperiences", GAME_OPTIONS);
  const fieldRoles = cleanMulti(formData, "fieldRoles", FIELD_ROLE_OPTIONS);

  if (!displayName) throw new Error("Name is required.");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: displayName },
  });

  const discordId = await getLinkedDiscordId(session.user.id);
  if (discordId) {
    await prisma.userProfile.upsert({
      where: { discordUserId: discordId },
      update: {
        displayName,
        countryCode: countryCode || null,
        gameExperiences,
        fieldRoles,
      },
      create: {
        discordUserId: discordId,
        displayName,
        countryCode: countryCode || null,
        gameExperiences,
        fieldRoles,
      },
    });
  }

  revalidatePath("/settings");
  revalidatePath("/");
}
