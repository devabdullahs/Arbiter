"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_ORG_COOKIE } from "./org-selection";

export async function switchActiveOrg(formData: FormData) {
  const orgId = String(formData.get("orgId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/") || "/";

  const cookieStore = await cookies();
  if (orgId) {
    cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
  } else {
    cookieStore.delete(ACTIVE_ORG_COOKIE);
  }

  redirect(returnTo);
}
