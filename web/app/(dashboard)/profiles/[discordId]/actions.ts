"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/web-authz";

function cleanMessage(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().slice(0, 300);
}

export async function requestProfileConnection(targetId: string, formData: FormData) {
  const { profile } = await requireUserProfile();
  if (profile.id === targetId) return;

  await prisma.profileConnectionRequest.upsert({
    where: {
      requesterId_targetId: {
        requesterId: profile.id,
        targetId,
      },
    },
    update: {
      status: "pending",
      message: cleanMessage(formData.get("message")) || null,
    },
    create: {
      requesterId: profile.id,
      targetId,
      message: cleanMessage(formData.get("message")) || null,
    },
  });

  revalidatePath("/profiles");
}

export async function saveWorker(targetId: string, formData: FormData) {
  const { profile } = await requireUserProfile();
  if (profile.id === targetId) return;

  await prisma.workerFavorite.upsert({
    where: {
      ownerId_workerId: {
        ownerId: profile.id,
        workerId: targetId,
      },
    },
    update: {
      priority: formData.get("priority") === "on",
      note: cleanMessage(formData.get("note")) || null,
    },
    create: {
      ownerId: profile.id,
      workerId: targetId,
      priority: formData.get("priority") === "on",
      note: cleanMessage(formData.get("note")) || null,
    },
  });

  revalidatePath("/workers");
}
