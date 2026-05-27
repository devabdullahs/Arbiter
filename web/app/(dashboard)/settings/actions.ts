"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { revalidatePath } from "next/cache";

import { getLinkedDiscordId, getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

import { FIELD_ROLE_OPTIONS, GAME_OPTIONS } from "./options";

const MAX_BIO_LENGTH = 500;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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

function cleanVisibility(value: FormDataEntryValue | null) {
  const visibility = String(value ?? "private");
  return ["private", "connections", "public"].includes(visibility)
    ? visibility
    : "private";
}

async function saveAvatar(profileId: string, value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null;

  const extension = AVATAR_TYPES[value.type];
  if (!extension) {
    throw new Error("Profile picture must be a PNG, JPG, or WebP image.");
  }
  if (value.size > MAX_AVATAR_BYTES) {
    throw new Error("Profile picture must be 2 MB or smaller.");
  }

  const bytes = Buffer.from(await value.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
  await mkdir(uploadDir, { recursive: true });
  const filename = `${profileId}.${extension}`;
  await writeFile(path.join(uploadDir, filename), bytes);

  return {
    avatarUrl: `/uploads/avatars/${filename}`,
    avatarMimeType: value.type,
    avatarSizeBytes: value.size,
    avatarUpdatedAt: new Date(),
  };
}

export async function updateUserSettings(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("You must be signed in.");

  const displayName = cleanText(formData.get("displayName"));
  const countryCode = cleanCode(formData.get("countryCode"));
  const bio = cleanText(formData.get("bio"), MAX_BIO_LENGTH);
  const profileVisibility = cleanVisibility(formData.get("profileVisibility"));
  const openToWork = formData.get("openToWork") === "on";
  const gameExperiences = cleanMulti(formData, "gameExperiences", GAME_OPTIONS);
  const fieldRoles = cleanMulti(formData, "fieldRoles", FIELD_ROLE_OPTIONS);

  if (!displayName) throw new Error("Name is required.");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: displayName },
  });

  const discordId = await getLinkedDiscordId(session.user.id);
  if (discordId) {
    const profile = await prisma.userProfile.upsert({
      where: { discordUserId: discordId },
      update: {
        displayName,
        countryCode: countryCode || null,
        bio: bio || null,
        profileVisibility,
        openToWork,
        gameExperiences,
        fieldRoles,
      },
      create: {
        discordUserId: discordId,
        displayName,
        countryCode: countryCode || null,
        bio: bio || null,
        profileVisibility,
        openToWork,
        gameExperiences,
        fieldRoles,
      },
    });

    const avatar = await saveAvatar(profile.id, formData.get("avatar"));
    if (avatar) {
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: avatar,
      });
    }
  }

  revalidatePath("/settings");
  revalidatePath("/profiles");
  revalidatePath("/");
}
