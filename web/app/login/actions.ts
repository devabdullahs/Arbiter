"use server";

import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export async function markPasskeyUsed(credentialID: string) {
  const session = await getSession();
  if (!session || !credentialID) return;

  await prisma.passkey.updateMany({
    where: {
      userId: session.user.id,
      credentialID,
    },
    data: {
      lastUsedAt: new Date(),
    },
  });
}
