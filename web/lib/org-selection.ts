import { cookies } from "next/headers";

export const ACTIVE_ORG_COOKIE = "arbiter.active_org";

export async function getActiveOrgId() {
  return (await cookies()).get(ACTIVE_ORG_COOKIE)?.value ?? null;
}
