"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getSession } from "@/lib/auth-session";
import { ACTIVE_ORG_COOKIE } from "@/lib/org-selection";
import { prisma } from "@/lib/prisma";

async function requireUserId() {
  const session = await getSession();
  if (!session) throw new Error("You must be signed in.");
  return session.user.id;
}

export async function revokeSession(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("You must be signed in.");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Session is required.");
  // The current session is revoked by signing out, not from this list.
  if (id === session.session.id) {
    throw new Error("Use sign out to end your current session.");
  }
  await prisma.session.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/security");
}

export async function revokeOtherSessions() {
  const session = await getSession();
  if (!session) throw new Error("You must be signed in.");
  await prisma.session.deleteMany({
    where: { userId: session.user.id, id: { not: session.session.id } },
  });
  revalidatePath("/security");
}

export async function renamePasskey(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!id) throw new Error("Passkey is required.");
  if (!name) throw new Error("Passkey name is required.");

  await prisma.passkey.updateMany({
    where: { id, userId },
    data: { name },
  });

  revalidatePath("/security");
}

export async function deletePasskey(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");

  if (!id) throw new Error("Passkey is required.");

  await prisma.passkey.deleteMany({
    where: { id, userId },
  });

  revalidatePath("/security");
}

export async function unlinkDiscordAccount() {
  const userId = await requireUserId();

  await prisma.account.deleteMany({
    where: {
      userId,
      providerId: "discord",
    },
  });

  (await cookies()).delete(ACTIVE_ORG_COOKIE);

  revalidatePath("/");
  revalidatePath("/security");
}
