"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { revalidatePath } from "next/cache";

import { MatchStatus } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  enqueueDiscordMatchRefresh,
  MANAGER_ROLES,
  requireOrgRole,
} from "@/lib/web-authz";

const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
const EVIDENCE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function cleanText(value: FormDataEntryValue | null, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanInt(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Scores must be zero or greater.");
  }
  return parsed;
}

function cleanScoreType(value: FormDataEntryValue | null) {
  const type = String(value ?? "match");
  return ["match", "map", "round", "game", "penalty"].includes(type)
    ? type
    : "match";
}

function cleanStatus(value: FormDataEntryValue | null) {
  const status = String(value ?? "").toUpperCase();
  if (
    status === MatchStatus.PENDING ||
    status === MatchStatus.VETO ||
    status === MatchStatus.LIVE ||
    status === MatchStatus.DISPUTED ||
    status === MatchStatus.COMPLETE ||
    status === MatchStatus.CANCELLED
  ) {
    return status;
  }
  throw new Error("Invalid match status.");
}

async function loadMatchForAction(code: string) {
  const match = await prisma.match.findUnique({
    where: { publicCode: code.toUpperCase() },
    select: {
      id: true,
      publicCode: true,
      organizationId: true,
      teamAName: true,
      teamBName: true,
      status: true,
    },
  });

  if (!match) throw new Error("Match not found.");
  const auth = await requireOrgRole(match.organizationId, MANAGER_ROLES);
  return { match, auth };
}

async function saveEvidenceFile(matchId: string, value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null;

  const extension = EVIDENCE_TYPES[value.type];
  if (!extension) throw new Error("Evidence upload must be a PNG, JPG, or WebP image.");
  if (value.size > MAX_EVIDENCE_BYTES) {
    throw new Error("Evidence upload must be 8 MB or smaller.");
  }

  const bytes = Buffer.from(await value.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", "uploads", "evidence");
  await mkdir(uploadDir, { recursive: true });
  const filename = `${matchId}-${Date.now()}.${extension}`;
  await writeFile(path.join(uploadDir, filename), bytes);
  return `/uploads/evidence/${filename}`;
}

export async function submitWebScore(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForAction(code);
  const teamAScore = cleanInt(formData.get("teamAScore"));
  const teamBScore = cleanInt(formData.get("teamBScore"));
  const scoringType = cleanScoreType(formData.get("scoringType"));
  const comment = cleanText(formData.get("comment"));

  await prisma.$transaction(async (tx) => {
    await tx.scoreReport.create({
      data: {
        organizationId: match.organizationId,
        matchId: match.id,
        teamAScore,
        teamBScore,
        scoringType,
        comment: comment || null,
        status: "approved",
        submittedById: auth.profile.id,
        reviewedById: auth.profile.id,
        reviewedAt: new Date(),
      },
    });

    await tx.match.update({
      where: { id: match.id },
      data: {
        teamAScore,
        teamBScore,
        status: MatchStatus.LIVE,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.score",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode, teamAScore, teamBScore, scoringType },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}

export async function submitWebEvidence(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForAction(code);
  const note = cleanText(formData.get("note"));
  const url = cleanText(formData.get("url"), 1000);
  const uploadedUrl = await saveEvidenceFile(match.id, formData.get("evidence"));
  const finalUrl = uploadedUrl ?? url;

  if (!finalUrl) {
    throw new Error("Add an evidence URL or upload an image.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.evidence.create({
      data: {
        organizationId: match.organizationId,
        matchId: match.id,
        url: finalUrl,
        note: note || null,
        submittedById: auth.profile.id,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.evidence",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode, hasUpload: Boolean(uploadedUrl) },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/evidence");
}

export async function updateWebMatchStatus(code: string, formData: FormData) {
  const { match, auth } = await loadMatchForAction(code);
  const status = cleanStatus(formData.get("status"));
  const reason = cleanText(formData.get("reason"));

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        status,
        disputeReason: status === MatchStatus.DISPUTED ? reason || "Disputed from dashboard" : null,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: match.organizationId,
        actorId: auth.profile.id,
        action: "web.match.status",
        targetType: "match",
        targetId: match.id,
        metadata: { publicCode: match.publicCode, status, reason },
      },
    });
  });

  await enqueueDiscordMatchRefresh(match.organizationId, match.id);
  revalidatePath(`/matches/${match.publicCode}`);
  revalidatePath("/matches");
}
