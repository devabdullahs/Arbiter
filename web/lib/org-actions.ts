"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_ORG_COOKIE } from "./org-selection";
import { safeRelativePath } from "./safe-redirect";

export async function switchActiveOrg(formData: FormData) {
  const orgId = String(formData.get("orgId") ?? "");
  // Only redirect to a same-site path (the hidden field is attacker-shapeable).
  const returnTo = safeRelativePath(formData.get("returnTo")?.toString(), "/");

  const cookieStore = await cookies();
  if (orgId) {
    cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    cookieStore.delete(ACTIVE_ORG_COOKIE);
  }

  redirect(returnTo);
}
