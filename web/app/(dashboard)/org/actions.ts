"use server";

import { randomBytes } from "crypto";

import { revalidatePath } from "next/cache";

import { getAccessContext } from "@/lib/auth-session";
import { sendOrgInviteEmail } from "@/lib/email";
import { OrgMemberRole } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

const INVITABLE_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.ADMIN,
  OrgMemberRole.REFEREE,
  OrgMemberRole.PLAYER,
]);
const INVITE_MANAGER_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.OWNER,
  OrgMemberRole.ADMIN,
]);

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function roleFromForm(value: FormDataEntryValue | null) {
  const role = String(value ?? OrgMemberRole.REFEREE).toUpperCase();
  if (INVITABLE_ROLES.has(role as OrgMemberRole)) {
    return role as OrgMemberRole;
  }
  return OrgMemberRole.REFEREE;
}

async function requireInvitePermission(orgId: string) {
  const ctx = await getAccessContext();
  if (!ctx) throw new Error("You must be signed in.");

  const org = ctx.orgs.find((candidate) => candidate.id === orgId);
  if (!org || !INVITE_MANAGER_ROLES.has(org.role)) {
    throw new Error("Only org owners and admins can manage invites.");
  }

  return ctx;
}

function inviteUrl(token: string) {
  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return new URL(`/invite/${token}`, baseUrl).toString();
}

export async function createOrgInvite(formData: FormData) {
  const orgId = String(formData.get("organizationId") ?? "");
  const email = normalizeEmail(formData.get("email"));
  const role = roleFromForm(formData.get("role"));

  if (!orgId) throw new Error("Organization is required.");
  if (!email || !email.includes("@")) throw new Error("A valid email is required.");

  const ctx = await requireInvitePermission(orgId);
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });
  if (!org) throw new Error("Organization not found.");

  await prisma.orgInvite.updateMany({
    where: { organizationId: org.id, email, status: "pending" },
    data: { status: "revoked" },
  });

  const invite = await prisma.orgInvite.create({
    data: {
      organizationId: org.id,
      email,
      role,
      token: randomBytes(32).toString("base64url"),
      invitedById: ctx.session.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await sendOrgInviteEmail({
    to: email,
    orgName: org.name,
    role,
    url: inviteUrl(invite.token),
  });

  revalidatePath("/org");
}

export async function revokeOrgInvite(formData: FormData) {
  const inviteId = String(formData.get("inviteId") ?? "");
  if (!inviteId) throw new Error("Invite is required.");

  const invite = await prisma.orgInvite.findUnique({
    where: { id: inviteId },
    select: { organizationId: true },
  });
  if (!invite) return;

  await requireInvitePermission(invite.organizationId);
  await prisma.orgInvite.update({
    where: { id: inviteId },
    data: { status: "revoked" },
  });

  revalidatePath("/org");
}
