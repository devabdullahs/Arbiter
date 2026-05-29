"use server";

import { randomBytes } from "crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAccessContext, getLinkedDiscordId, getSession } from "@/lib/auth-session";
import { sendOrgInviteEmail } from "@/lib/email";
import { OrgMemberRole, Prisma } from "@/lib/generated/prisma";
import { presetKeyFromLabel, splitPresetList } from "@/lib/game-presets";
import { cleanResultLabel } from "@/lib/score-format";
import { ACTIVE_ORG_COOKIE } from "@/lib/org-selection";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

const INVITABLE_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.ADMIN,
  OrgMemberRole.MANAGER,
  OrgMemberRole.HEAD_REF,
  OrgMemberRole.REFEREE,
  OrgMemberRole.PLAYER,
]);
const INVITE_MANAGER_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.OWNER,
  OrgMemberRole.ADMIN,
  OrgMemberRole.MANAGER,
  OrgMemberRole.HEAD_REF,
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

function normalizeSnowflake(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeName(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizeOptionalText(value: FormDataEntryValue | null, max = 500) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

async function requireInvitePermission(orgId: string) {
  const ctx = await getAccessContext();
  if (!ctx) throw new Error("You must be signed in.");

  const org = ctx.orgs.find((candidate) => candidate.id === orgId);
  if (!org || !INVITE_MANAGER_ROLES.has(org.role)) {
    throw new Error("Only org owners, admins, managers, and head refs can manage this.");
  }

  return ctx;
}

function cleanAnnouncementTarget(kind: FormDataEntryValue | null) {
  const clean = String(kind ?? "everyone");
  return ["everyone", "staff", "players", "org_role", "team_role"].includes(clean)
    ? clean
    : "everyone";
}

function cleanAnnouncementTargetValue(
  targetKind: string,
  value: FormDataEntryValue | null,
) {
  const clean = normalizeName(value).slice(0, 80);
  if (targetKind === "org_role") {
    const role = clean.toUpperCase();
    return Object.values(OrgMemberRole).includes(role as OrgMemberRole)
      ? role
      : OrgMemberRole.REFEREE;
  }
  if (targetKind === "team_role") {
    return ["player", "coach", "manager", "team_leader"].includes(clean)
      ? clean
      : "player";
  }
  return null;
}

function cleanOptionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createOrgAnnouncement(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) throw new Error("Organization is required.");

  const ctx = await requireInvitePermission(organizationId);
  const title = normalizeName(formData.get("title")).slice(0, 120);
  const body = normalizeName(formData.get("body")).slice(0, 1200);
  const targetKind = cleanAnnouncementTarget(formData.get("targetKind"));
  const targetValue = cleanAnnouncementTargetValue(
    targetKind,
    formData.get("targetValue"),
  );
  const expiresAt = cleanOptionalDate(formData.get("expiresAt"));

  if (!title) throw new Error("Announcement title is required.");
  if (!body) throw new Error("Announcement body is required.");

  const profile = ctx.discordId
    ? await prisma.userProfile.findUnique({
        where: { discordUserId: ctx.discordId },
        select: { id: true },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    const announcement = await tx.announcement.create({
      data: {
        organizationId,
        title,
        body,
        targetKind,
        targetValue,
        createdById: profile?.id ?? null,
        expiresAt,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId,
        actorId: profile?.id ?? null,
        action: "org.announcement.created",
        targetType: "announcement",
        targetId: announcement.id,
        metadata: { title, targetKind, targetValue, expiresAt },
      },
    });
  });

  revalidatePath("/org/announcements");
  revalidatePath("/notifications");
  revalidatePath("/todo");
}

export async function archiveOrgAnnouncement(formData: FormData) {
  const announcementId = String(formData.get("announcementId") ?? "");
  if (!announcementId) throw new Error("Announcement is required.");

  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, organizationId: true, title: true },
  });
  if (!announcement) return;

  const ctx = await requireInvitePermission(announcement.organizationId);
  const profile = ctx.discordId
    ? await prisma.userProfile.findUnique({
        where: { discordUserId: ctx.discordId },
        select: { id: true },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.announcement.update({
      where: { id: announcement.id },
      data: { archivedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        organizationId: announcement.organizationId,
        actorId: profile?.id ?? null,
        action: "org.announcement.archived",
        targetType: "announcement",
        targetId: announcement.id,
        metadata: { title: announcement.title },
      },
    });
  });

  revalidatePath("/org/announcements");
  revalidatePath("/notifications");
  revalidatePath("/todo");
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

export async function updateOrgWebPermissions(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) throw new Error("Organization is required.");

  await requireInvitePermission(organizationId);

  const webPermissions = {
    playersCanViewMatches: formData.get("playersCanViewMatches") === "on",
    playersCanViewTeams: formData.get("playersCanViewTeams") === "on",
    playersCanViewEvidence: formData.get("playersCanViewEvidence") === "on",
    refereesCanViewWorkers: formData.get("refereesCanViewWorkers") === "on",
  };

  await prisma.orgSettings.upsert({
    where: { organizationId },
    update: { webPermissions },
    create: { organizationId, webPermissions },
  });

  revalidatePath("/org");
  revalidatePath("/org/settings");
}

export async function upsertOrgRulesPreset(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) throw new Error("Organization is required.");

  const ctx = await requireInvitePermission(organizationId);
  const label = normalizeName(formData.get("label")).slice(0, 80);
  const key = presetKeyFromLabel(label);
  const gameTitle = normalizeOptionalText(formData.get("gameTitle"), 80);
  const mapPool = splitPresetList(formData.get("mapPool"));
  const characterPool = splitPresetList(formData.get("characterPool"));
  const vetoMode = String(formData.get("vetoMode") ?? "series_picks");
  const notes = normalizeOptionalText(formData.get("notes"), 500);

  if (!key) throw new Error("Preset name must contain at least one letter or number.");
  if (mapPool.length === 0) throw new Error("Add at least one map or game entry.");

  await prisma.rulesPreset.upsert({
    where: { organizationId_key: { organizationId, key } },
    update: {
      label,
      gameTitle,
      mapPool,
      characterPool: characterPool.length ? characterPool : Prisma.JsonNull,
      vetoMode,
      notes,
    },
    create: {
      organizationId,
      key,
      label,
      gameTitle,
      mapPool,
      characterPool: characterPool.length ? characterPool : Prisma.JsonNull,
      vetoMode,
      notes,
      createdById: ctx.session.user.id,
    },
  });

  revalidatePath("/org");
  revalidatePath("/org/presets");
  revalidatePath("/matches");
}

export async function deleteOrgRulesPreset(formData: FormData) {
  const presetId = String(formData.get("presetId") ?? "");
  if (!presetId) throw new Error("Preset is required.");

  const preset = await prisma.rulesPreset.findUnique({
    where: { id: presetId },
    select: { organizationId: true },
  });
  if (!preset) return;

  await requireInvitePermission(preset.organizationId);
  await prisma.rulesPreset.delete({ where: { id: presetId } });

  revalidatePath("/org");
  revalidatePath("/org/presets");
  revalidatePath("/matches");
}

function cleanRulingAppliesTo(value: FormDataEntryValue | null) {
  const clean = String(value ?? "subject_loses");
  return ["subject_loses", "subject_wins", "no_contest"].includes(clean)
    ? clean
    : "subject_loses";
}

function cleanSmallInt(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 99
    ? parsed
    : fallback;
}

export async function upsertOrgRulingPreset(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) throw new Error("Organization is required.");

  const ctx = await requireInvitePermission(organizationId);
  const label = normalizeName(formData.get("label")).slice(0, 80);
  const key = presetKeyFromLabel(label);
  const resultLabel = cleanResultLabel(formData.get("resultLabel"));
  const appliesTo = cleanRulingAppliesTo(formData.get("appliesTo"));
  const defaultSubjectScore = cleanSmallInt(formData.get("defaultSubjectScore"));
  const defaultOpponentScore = cleanSmallInt(formData.get("defaultOpponentScore"));
  const notes = normalizeOptionalText(formData.get("notes"), 500);

  if (!key) throw new Error("Ruling name must contain at least one letter or number.");
  if (!resultLabel) throw new Error("Choose a ruling label.");

  await prisma.rulingPreset.upsert({
    where: { organizationId_key: { organizationId, key } },
    update: {
      label,
      resultLabel,
      defaultSubjectScore,
      defaultOpponentScore,
      appliesTo,
      notes,
    },
    create: {
      organizationId,
      key,
      label,
      resultLabel,
      defaultSubjectScore,
      defaultOpponentScore,
      appliesTo,
      notes,
      createdById: ctx.session.user.id,
    },
  });

  revalidatePath("/org/rulings");
}

export async function deleteOrgRulingPreset(formData: FormData) {
  const presetId = String(formData.get("presetId") ?? "");
  if (!presetId) throw new Error("Ruling preset is required.");

  const preset = await prisma.rulingPreset.findUnique({
    where: { id: presetId },
    select: { organizationId: true },
  });
  if (!preset) return;

  await requireInvitePermission(preset.organizationId);
  await prisma.rulingPreset.delete({ where: { id: presetId } });

  revalidatePath("/org/rulings");
}

export async function createOrganization(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("You must be signed in.");

  const discordId = await getLinkedDiscordId(session.user.id);
  if (!discordId) {
    throw new Error("Link Discord before creating an organization.");
  }

  const name = normalizeName(formData.get("name")) || normalizeName(formData.get("manualName"));
  const discordGuildId = normalizeSnowflake(formData.get("discordGuildId"));

  if (!name) throw new Error("Organization name is required.");
  if (!discordGuildId) throw new Error("Discord server ID is required.");

  const existing = await prisma.organization.findUnique({
    where: { discordGuildId },
    select: { id: true },
  });
  if (existing) {
    throw new Error("An organization for this Discord server already exists.");
  }

  const profile = await prisma.userProfile.upsert({
    where: { discordUserId: discordId },
    update: { displayName: session.user.name },
    create: { discordUserId: discordId, displayName: session.user.name },
  });

  const org = await prisma.organization.create({
    data: {
      name,
      discordGuildId,
      members: {
        create: {
          userProfileId: profile.id,
          role: OrgMemberRole.OWNER,
        },
      },
      auditLogs: {
        create: {
          actorId: profile.id,
          action: "org.created",
          targetType: "Organization",
          metadata: { name, discordGuildId },
        },
      },
    },
  });

  (await cookies()).set(ACTIVE_ORG_COOKIE, org.id, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });

  revalidatePath("/");
  revalidatePath("/org");
  redirect("/org");
}
