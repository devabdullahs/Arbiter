"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { MatchStatus, Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { cleanResultLabel } from "@/lib/score-format";
import {
  MANAGER_ROLES,
  REFEREE_ASSIGNMENT_MANAGER_ROLES,
  requireOrgRole,
} from "@/lib/web-authz";
import {
  type BracketFormat,
  generateBracket,
  type Slot,
} from "@/lib/bracket";

const FORMATS = new Set<BracketFormat>([
  "single_elimination",
  "double_elimination",
  "round_robin",
]);

function makeCode() {
  return randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
}

function cleanText(value: FormDataEntryValue | null, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanInt(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function cleanFormat(value: FormDataEntryValue | null): BracketFormat {
  const v = String(value ?? "single_elimination");
  return FORMATS.has(v as BracketFormat) ? (v as BracketFormat) : "single_elimination";
}

function cleanRefereeClaimMode(value: FormDataEntryValue | null) {
  const mode = String(value ?? "open");
  return ["open", "assigned"].includes(mode) ? mode : "open";
}

function bracketWinnerFromResult(
  teamAScore: number,
  teamBScore: number,
  teamAResult: string | null,
  teamBResult: string | null,
): Slot | null {
  if (teamAResult === "W" || ["DQ", "FT", "FF", "L"].includes(teamBResult ?? "")) {
    return "teamA";
  }
  if (teamBResult === "W" || ["DQ", "FT", "FF", "L"].includes(teamAResult ?? "")) {
    return "teamB";
  }
  if (teamAResult === "NC" || teamBResult === "NC") return null;
  if (teamAScore === teamBScore) return null;
  return teamAScore > teamBScore ? "teamA" : "teamB";
}

async function loadTournamentForAction(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      publicCode: true,
      organizationId: true,
      format: true,
      status: true,
      bestOf: true,
      thirdPlace: true,
      refereeClaimMode: true,
      refereeClaimLimit: true,
    },
  });
  if (!tournament) throw new Error("Tournament not found.");
  const auth = await requireOrgRole(tournament.organizationId, MANAGER_ROLES);
  return { tournament, auth };
}

export async function updateTournamentRefereeSettings(
  tournamentId: string,
  formData: FormData,
) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      publicCode: true,
      organizationId: true,
      refereeClaimMode: true,
      refereeClaimLimit: true,
    },
  });
  if (!tournament) throw new Error("Tournament not found.");
  const auth = await requireOrgRole(
    tournament.organizationId,
    REFEREE_ASSIGNMENT_MANAGER_ROLES,
  );

  const refereeClaimMode = cleanRefereeClaimMode(formData.get("refereeClaimMode"));
  const refereeClaimLimit = cleanInt(
    formData.get("refereeClaimLimit"),
    tournament.refereeClaimLimit,
    1,
    12,
  );

  await prisma.$transaction(async (tx) => {
    await tx.tournament.update({
      where: { id: tournament.id },
      data: { refereeClaimMode, refereeClaimLimit },
    });
    await tx.match.updateMany({
      where: {
        tournamentId: tournament.id,
        refereeClaimMode: "tournament",
      },
      data: { refereeClaimLimit },
    });
    await tx.auditLog.create({
      data: {
        organizationId: tournament.organizationId,
        actorId: auth.profile.id,
        action: "web.tournament.referee_settings",
        targetType: "tournament",
        targetId: tournament.id,
        metadata: {
          publicCode: tournament.publicCode,
          refereeClaimMode,
          refereeClaimLimit,
        },
      },
    });
  });

  revalidatePath(`/tournaments/${tournament.publicCode}`);
  revalidatePath("/todo");
}

export async function createTournament(formData: FormData) {
  const organizationId = cleanText(formData.get("organizationId"), 80);
  if (!organizationId) throw new Error("Organization is required.");
  const auth = await requireOrgRole(organizationId, MANAGER_ROLES);

  const name = cleanText(formData.get("name"), 120);
  if (!name) throw new Error("Tournament name is required.");
  const format = cleanFormat(formData.get("format"));
  const gameTitle = cleanText(formData.get("gameTitle"), 80) || null;
  const bestOf = cleanInt(formData.get("bestOf"), 1, 1, 99);
  const thirdPlace = formData.get("thirdPlace") === "on";

  const tournament = await prisma.tournament.create({
    data: {
      publicCode: makeCode(),
      organizationId,
      name,
      gameTitle,
      format,
      bestOf,
      thirdPlace,
    },
    select: { publicCode: true, id: true, organizationId: true },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      actorId: auth.profile.id,
      action: "web.tournament.create",
      targetType: "tournament",
      targetId: tournament.id,
      metadata: { publicCode: tournament.publicCode, name, format },
    },
  });

  revalidatePath("/tournaments");
  redirect(`/tournaments/${tournament.publicCode}`);
}

export type CreateTournamentState = { error?: string };

export async function createTournamentWithState(
  _state: CreateTournamentState,
  formData: FormData,
): Promise<CreateTournamentState> {
  try {
    await createTournament(formData);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    // re-throw Next redirect signal (digest-based)
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return { error: error instanceof Error ? error.message : "Could not create tournament." };
  }
  return {};
}

export async function addTournamentEntry(tournamentId: string, formData: FormData) {
  const { tournament } = await loadTournamentForAction(tournamentId);
  if (tournament.status !== "draft") {
    throw new Error("Teams can only be changed before the bracket is generated.");
  }

  const teamId = cleanText(formData.get("teamId"), 80) || null;
  let teamName = cleanText(formData.get("teamName"), 120);

  if (teamId) {
    const team = await prisma.team.findFirst({
      where: { id: teamId, organizationId: tournament.organizationId },
      select: { name: true },
    });
    if (!team) throw new Error("That team is not in this organization.");
    teamName = team.name;
  }
  if (!teamName) throw new Error("Select a team or enter a name.");

  const existingSeeds = await prisma.tournamentEntry.findMany({
    where: { tournamentId },
    select: { seed: true, teamId: true },
  });
  if (teamId && existingSeeds.some((entry) => entry.teamId === teamId)) {
    throw new Error("That team is already entered.");
  }
  const nextSeed = existingSeeds.reduce((max, entry) => Math.max(max, entry.seed), 0) + 1;

  await prisma.tournamentEntry.create({
    data: { tournamentId, teamId, teamName, seed: nextSeed },
  });

  revalidatePath(`/tournaments/${tournament.publicCode}`);
}

export async function removeTournamentEntry(entryId: string) {
  const entry = await prisma.tournamentEntry.findUnique({
    where: { id: entryId },
    select: { tournamentId: true, seed: true },
  });
  if (!entry) throw new Error("Entry not found.");
  const { tournament } = await loadTournamentForAction(entry.tournamentId);
  if (tournament.status !== "draft") {
    throw new Error("Teams can only be changed before the bracket is generated.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.tournamentEntry.delete({ where: { id: entryId } });
    // close the gap so seeds stay 1..n contiguous
    const remaining = await tx.tournamentEntry.findMany({
      where: { tournamentId: entry.tournamentId },
      orderBy: { seed: "asc" },
      select: { id: true },
    });
    // shift to a temporary high range first to dodge the unique constraint
    await Promise.all(
      remaining.map((row, index) =>
        tx.tournamentEntry.update({
          where: { id: row.id },
          data: { seed: 1000 + index },
        }),
      ),
    );
    await Promise.all(
      remaining.map((row, index) =>
        tx.tournamentEntry.update({
          where: { id: row.id },
          data: { seed: index + 1 },
        }),
      ),
    );
  });

  revalidatePath(`/tournaments/${tournament.publicCode}`);
}

export async function generateTournamentBracket(tournamentId: string) {
  const { tournament, auth } = await loadTournamentForAction(tournamentId);

  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId },
    orderBy: { seed: "asc" },
    select: { id: true, teamName: true, seed: true },
  });
  if (entries.length < 2) throw new Error("Add at least 2 teams first.");

  const generated = generateBracket(
    tournament.format as BracketFormat,
    entries.map((entry) => ({ id: entry.id, teamName: entry.teamName, seed: entry.seed })),
    { thirdPlace: tournament.thirdPlace },
  );

  const entryBySeed = new Map(entries.map((entry) => [entry.seed, entry]));

  await prisma.$transaction(async (tx) => {
    await tx.bracketNode.deleteMany({ where: { tournamentId } });

    const keyToId = new Map<string, string>();
    // pass 1: create every node with its round-0 / round-robin seatings
    for (const node of generated.nodes) {
      const entryA = node.teamASeed != null ? entryBySeed.get(node.teamASeed) : null;
      const entryB = node.teamBSeed != null ? entryBySeed.get(node.teamBSeed) : null;

      let status = "pending";
      const isRoundRobin = node.bracket === "round_robin";
      const hasSeating = node.teamASeed != null || node.teamBSeed != null;
      if (isRoundRobin) {
        status = "ready";
      } else if (hasSeating) {
        const onlyOne =
          (node.teamASeed != null) !== (node.teamBSeed != null);
        status = onlyOne ? "bye" : "ready";
      }

      const created = await tx.bracketNode.create({
        data: {
          tournamentId,
          bracket: node.bracket,
          roundIndex: node.roundIndex,
          slotIndex: node.slotIndex,
          label: node.label,
          bestOf: tournament.bestOf,
          teamAEntryId: entryA?.id ?? null,
          teamBEntryId: entryB?.id ?? null,
          teamAName: entryA?.teamName ?? null,
          teamBName: entryB?.teamName ?? null,
          teamASource: node.teamASource ?? null,
          teamBSource: node.teamBSource ?? null,
          status,
        },
        select: { id: true },
      });
      keyToId.set(node.key, created.id);
    }

    // pass 2: resolve advancement pointers
    for (const node of generated.nodes) {
      const id = keyToId.get(node.key)!;
      await tx.bracketNode.update({
        where: { id },
        data: {
          winnerToNodeId: node.winnerToKey ? keyToId.get(node.winnerToKey) ?? null : null,
          winnerToSlot: node.winnerToSlot ?? null,
          loserToNodeId: node.loserToKey ? keyToId.get(node.loserToKey) ?? null : null,
          loserToSlot: node.loserToSlot ?? null,
        },
      });
    }

    // pass 3: auto-advance round-0 byes
    const byeNodes = await tx.bracketNode.findMany({
      where: { tournamentId, status: "bye" },
    });
    for (const bye of byeNodes) {
      const winnerSlot: Slot = bye.teamAName ? "teamA" : "teamB";
      const winnerName = winnerSlot === "teamA" ? bye.teamAName : bye.teamBName;
      const winnerEntryId = winnerSlot === "teamA" ? bye.teamAEntryId : bye.teamBEntryId;
      await tx.bracketNode.update({
        where: { id: bye.id },
        data: { winnerSlot, status: "complete" },
      });
      if (bye.winnerToNodeId && bye.winnerToSlot && winnerName) {
        await placeTeam(tx, bye.winnerToNodeId, bye.winnerToSlot as Slot, winnerEntryId, winnerName);
      }
    }
    await settleBracketByes(tx, tournamentId);

    await tx.tournament.update({
      where: { id: tournamentId },
      data: { status: "active", startedAt: new Date(), championName: null, completedAt: null },
    });
  });

  await prisma.auditLog.create({
    data: {
      organizationId: tournament.organizationId,
      actorId: auth.profile.id,
      action: "web.tournament.generate",
      targetType: "tournament",
      targetId: tournamentId,
      metadata: { format: tournament.format, teams: entries.length },
    },
  });

  revalidatePath(`/tournaments/${tournament.publicCode}`);
}

export async function resetTournamentBracket(tournamentId: string) {
  const { tournament } = await loadTournamentForAction(tournamentId);
  await prisma.$transaction(async (tx) => {
    await tx.bracketNode.deleteMany({ where: { tournamentId } });
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { status: "draft", startedAt: null, completedAt: null, championName: null },
    });
  });
  revalidatePath(`/tournaments/${tournament.publicCode}`);
}

export async function syncTournamentBracket(tournamentId: string) {
  const { tournament, auth } = await loadTournamentForAction(tournamentId);
  await prisma.$transaction(async (tx) => {
    await settleBracketByes(tx, tournament.id);
    await tx.auditLog.create({
      data: {
        organizationId: tournament.organizationId,
        actorId: auth.profile.id,
        action: "web.tournament.sync_bracket",
        targetType: "tournament",
        targetId: tournament.id,
        metadata: { publicCode: tournament.publicCode },
      },
    });
  });
  revalidatePath(`/tournaments/${tournament.publicCode}`);
}

export async function openBracketMatch(nodeId: string) {
  const node = await prisma.bracketNode.findUnique({
    where: { id: nodeId },
    select: {
      id: true,
      tournamentId: true,
      bestOf: true,
      teamAEntryId: true,
      teamBEntryId: true,
      teamAName: true,
      teamBName: true,
      match: { select: { publicCode: true } },
      tournament: {
        select: {
          id: true,
          publicCode: true,
          organizationId: true,
          gameTitle: true,
          refereeClaimMode: true,
          refereeClaimLimit: true,
        },
      },
    },
  });
  if (!node) throw new Error("Bracket match not found.");
  const { tournament, auth } = await loadTournamentForAction(node.tournamentId);
  if (node.match?.publicCode) {
    redirect(`/matches/${node.match.publicCode}`);
  }
  if (!node.teamAName || !node.teamBName) {
    throw new Error("Both bracket teams must be decided before opening match management.");
  }

  const entryIds = [node.teamAEntryId, node.teamBEntryId].filter(Boolean) as string[];
  const entries = entryIds.length
    ? await prisma.tournamentEntry.findMany({
        where: { id: { in: entryIds } },
        select: { id: true, teamId: true },
      })
    : [];
  const teamIdByEntryId = new Map(entries.map((entry) => [entry.id, entry.teamId]));
  const teamAId = node.teamAEntryId ? teamIdByEntryId.get(node.teamAEntryId) : null;
  const teamBId = node.teamBEntryId ? teamIdByEntryId.get(node.teamBEntryId) : null;

  const match = await prisma.$transaction(async (tx) => {
    const created = await tx.match.create({
      data: {
        publicCode: makeCode(),
        organizationId: tournament.organizationId,
        tournamentId: tournament.id,
        createdById: auth.profile.id,
        teamAName: node.teamAName!,
        teamBName: node.teamBName!,
        bestOf: node.bestOf,
        rulesPreset: node.tournament.gameTitle ?? "generic",
        vetoMode: "series_picks",
        mapPool: [],
        refereeClaimMode: "tournament",
        refereeClaimLimit: node.tournament.refereeClaimLimit,
        ...(teamAId || teamBId
          ? {
              participants: {
                create: [
                  ...(teamAId ? [{ teamId: teamAId, slot: "teamA" }] : []),
                  ...(teamBId ? [{ teamId: teamBId, slot: "teamB" }] : []),
                ],
              },
            }
          : {}),
      },
      select: { id: true, publicCode: true },
    });

    await tx.bracketNode.update({
      where: { id: node.id },
      data: { matchId: created.id },
    });

    await tx.auditLog.create({
      data: {
        organizationId: tournament.organizationId,
        actorId: auth.profile.id,
        action: "web.tournament.open_match",
        targetType: "bracket_node",
        targetId: node.id,
        metadata: {
          tournamentCode: tournament.publicCode,
          matchCode: created.publicCode,
        },
      },
    });

    return created;
  });

  revalidatePath(`/tournaments/${tournament.publicCode}`);
  redirect(`/matches/${match.publicCode}`);
}

type Tx = Prisma.TransactionClient;

async function placeTeam(
  tx: Tx,
  nodeId: string,
  slot: Slot,
  entryId: string | null,
  teamName: string,
) {
  const node = await tx.bracketNode.findUnique({
    where: { id: nodeId },
    select: { teamAName: true, teamBName: true, status: true },
  });
  if (!node) return;

  const data: Record<string, unknown> =
    slot === "teamA"
      ? { teamAEntryId: entryId, teamAName: teamName }
      : { teamBEntryId: entryId, teamBName: teamName };

  const otherName = slot === "teamA" ? node.teamBName : node.teamAName;
  if (otherName && node.status === "pending") {
    data.status = "ready";
  }

  await tx.bracketNode.update({ where: { id: nodeId }, data });
}

async function settleBracketByes(tx: Tx, tournamentId: string) {
  let changed = true;
  while (changed) {
    changed = false;
    const nodes = await tx.bracketNode.findMany({
      where: { tournamentId },
      select: {
        id: true,
        bracket: true,
        roundIndex: true,
        teamAEntryId: true,
        teamBEntryId: true,
        teamAName: true,
        teamBName: true,
        teamASource: true,
        teamBSource: true,
        status: true,
        winnerToNodeId: true,
        winnerToSlot: true,
        loserToNodeId: true,
        loserToSlot: true,
      },
    });

    const incoming = new Map<string, (typeof nodes)[number]>();
    for (const node of nodes) {
      if (node.winnerToNodeId && node.winnerToSlot) {
        incoming.set(`${node.winnerToNodeId}:${node.winnerToSlot}`, node);
      }
      if (node.loserToNodeId && node.loserToSlot) {
        incoming.set(`${node.loserToNodeId}:${node.loserToSlot}`, node);
      }
    }

    const slotClosed = (targetId: string, slot: Slot, hasName: boolean, source: string | null) => {
      if (hasName) return false;
      if (!source) return true;
      const parent = incoming.get(`${targetId}:${slot}`);
      return Boolean(parent && (parent.status === "complete" || parent.status === "bye"));
    };

    for (const node of nodes) {
      if (node.status === "complete" || node.status === "bye") continue;
      if (node.bracket === "grand_final" && node.roundIndex > 0) continue;

      const hasA = Boolean(node.teamAName);
      const hasB = Boolean(node.teamBName);
      if (hasA === hasB) continue;

      const missingSlot: Slot = hasA ? "teamB" : "teamA";
      const missingClosed = slotClosed(
        node.id,
        missingSlot,
        missingSlot === "teamA" ? hasA : hasB,
        missingSlot === "teamA" ? node.teamASource : node.teamBSource,
      );
      if (!missingClosed) continue;

      const winnerSlot: Slot = hasA ? "teamA" : "teamB";
      const winnerName = winnerSlot === "teamA" ? node.teamAName : node.teamBName;
      const winnerEntryId = winnerSlot === "teamA" ? node.teamAEntryId : node.teamBEntryId;
      if (!winnerName) continue;

      await tx.bracketNode.update({
        where: { id: node.id },
        data: { winnerSlot, status: "complete", teamAScore: 0, teamBScore: 0 },
      });
      if (node.winnerToNodeId && node.winnerToSlot) {
        await placeTeam(
          tx,
          node.winnerToNodeId,
          node.winnerToSlot as Slot,
          winnerEntryId,
          winnerName,
        );
      }
      changed = true;
      break;
    }
  }
}

export async function reportBracketResult(nodeId: string, formData: FormData) {
  const node = await prisma.bracketNode.findUnique({
    where: { id: nodeId },
    select: {
      id: true,
      tournamentId: true,
      bracket: true,
      roundIndex: true,
      teamAEntryId: true,
      teamBEntryId: true,
      teamAName: true,
      teamBName: true,
      status: true,
      winnerToNodeId: true,
      winnerToSlot: true,
      loserToNodeId: true,
      loserToSlot: true,
      matchId: true,
    },
  });
  if (!node) throw new Error("Bracket match not found.");
  const { tournament } = await loadTournamentForAction(node.tournamentId);

  if (!node.teamAName || !node.teamBName) {
    throw new Error("Both teams must be decided before reporting a result.");
  }
  const teamAScore = cleanInt(formData.get("teamAScore"), 0, 0, 999);
  const teamBScore = cleanInt(formData.get("teamBScore"), 0, 0, 999);
  const teamAResult = cleanResultLabel(formData.get("teamAResult"));
  const teamBResult = cleanResultLabel(formData.get("teamBResult"));
  const isRoundRobin = node.bracket === "round_robin";
  const winnerSlot = bracketWinnerFromResult(
    teamAScore,
    teamBScore,
    teamAResult,
    teamBResult,
  );
  if (!isRoundRobin && !winnerSlot) {
    throw new Error("Knockout matches need a winner. Pick a winner by score or ruling.");
  }

  await prisma.$transaction(async (tx) => {
    if (node.status === "complete") {
      await resetDownstreamBracket(tx, node.id);
      await tx.tournament.update({
        where: { id: tournament.id },
        data: { status: "active", championName: null, completedAt: null },
      });
    }

    await tx.bracketNode.update({
      where: { id: node.id },
      data: {
        teamAScore,
        teamBScore,
        teamAResult,
        teamBResult,
        winnerSlot,
        status: "complete",
      },
    });

    if (node.matchId) {
      await tx.match.update({
        where: { id: node.matchId },
        data: {
          teamAScore,
          teamBScore,
          teamAResult,
          teamBResult,
          status: MatchStatus.COMPLETE,
        },
      });
    }

    if (isRoundRobin || !winnerSlot) {
      await maybeCompleteRoundRobin(tx, tournament.id);
      return;
    }

    const winnerName = winnerSlot === "teamA" ? node.teamAName! : node.teamBName!;
    const winnerEntryId = winnerSlot === "teamA" ? node.teamAEntryId : node.teamBEntryId;
    const loserName = winnerSlot === "teamA" ? node.teamBName! : node.teamAName!;
    const loserEntryId = winnerSlot === "teamA" ? node.teamBEntryId : node.teamAEntryId;

    // Grand-final has conditional advancement (bracket reset "if necessary").
    if (node.bracket === "grand_final") {
      if (node.roundIndex === 0) {
        if (winnerSlot === "teamA") {
          await finishTournament(tx, tournament.id, winnerName);
        } else {
          const reset = await tx.bracketNode.findFirst({
            where: { tournamentId: tournament.id, bracket: "grand_final", roundIndex: 1 },
            select: { id: true },
          });
          if (reset) {
            await tx.bracketNode.update({
              where: { id: reset.id },
              data: {
                teamAEntryId: node.teamAEntryId,
                teamBEntryId: node.teamBEntryId,
                teamAName: node.teamAName,
                teamBName: node.teamBName,
                status: "ready",
              },
            });
          } else {
            await finishTournament(tx, tournament.id, winnerName);
          }
        }
      } else {
        await finishTournament(tx, tournament.id, winnerName);
      }
      return;
    }

    if (node.winnerToNodeId && node.winnerToSlot) {
      await placeTeam(tx, node.winnerToNodeId, node.winnerToSlot as Slot, winnerEntryId, winnerName);
    }
    if (node.loserToNodeId && node.loserToSlot) {
      await placeTeam(tx, node.loserToNodeId, node.loserToSlot as Slot, loserEntryId, loserName);
    }
    await settleBracketByes(tx, tournament.id);

    if (tournament.format === "single_elimination" && !node.winnerToNodeId && node.bracket === "winners") {
      await finishTournament(tx, tournament.id, winnerName);
    }
  });

  revalidatePath(`/tournaments/${tournament.publicCode}`);
  if (node.matchId) revalidatePath("/matches");
}

export type BracketResultState = { error?: string };

export async function reportBracketResultWithState(
  nodeId: string,
  _state: BracketResultState,
  formData: FormData,
): Promise<BracketResultState> {
  try {
    await reportBracketResult(nodeId, formData);
    return {};
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not report bracket result.",
    };
  }
}
async function resetDownstreamBracket(tx: Tx, nodeId: string) {
  const allNodes = await tx.bracketNode.findMany({
    where: {
      tournamentId: (
        await tx.bracketNode.findUniqueOrThrow({
          where: { id: nodeId },
          select: { tournamentId: true },
        })
      ).tournamentId,
    },
    select: {
      id: true,
      winnerToNodeId: true,
      loserToNodeId: true,
      teamASource: true,
      teamBSource: true,
    },
  });

  const byParent = new Map<string, string[]>();
  for (const node of allNodes) {
    for (const childId of [node.winnerToNodeId, node.loserToNodeId]) {
      if (!childId) continue;
      const children = byParent.get(node.id) ?? [];
      children.push(childId);
      byParent.set(node.id, children);
    }
  }

  const descendants = new Set<string>();
  const queue = [...(byParent.get(nodeId) ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (descendants.has(id)) continue;
    descendants.add(id);
    queue.push(...(byParent.get(id) ?? []));
  }

  if (!descendants.size) return;

  const descendantRows = allNodes.filter((node) => descendants.has(node.id));
  for (const row of descendantRows) {
    await tx.bracketNode.update({
      where: { id: row.id },
      data: {
        ...(row.teamASource
          ? { teamAEntryId: null, teamAName: null }
          : {}),
        ...(row.teamBSource
          ? { teamBEntryId: null, teamBName: null }
          : {}),
        teamAScore: 0,
        teamBScore: 0,
        teamAResult: null,
        teamBResult: null,
        winnerSlot: null,
        status: "pending",
      },
    });
  }
}

async function finishTournament(tx: Tx, tournamentId: string, championName: string) {
  await tx.tournament.update({
    where: { id: tournamentId },
    data: { status: "complete", completedAt: new Date(), championName },
  });
}

async function maybeCompleteRoundRobin(tx: Tx, tournamentId: string) {
  const nodes = await tx.bracketNode.findMany({
    where: { tournamentId, bracket: "round_robin" },
    select: { status: true, teamAName: true, teamBName: true, teamAScore: true, teamBScore: true, winnerSlot: true },
  });
  if (!nodes.length || nodes.some((n) => n.status !== "complete")) return;

  // standings: 3 pts win, 1 draw
  const points = new Map<string, number>();
  for (const n of nodes) {
    if (!n.teamAName || !n.teamBName) continue;
    const add = (name: string, value: number) =>
      points.set(name, (points.get(name) ?? 0) + value);
    if (n.winnerSlot === "teamA") {
      add(n.teamAName, 3);
      add(n.teamBName, 0);
    } else if (n.winnerSlot === "teamB") {
      add(n.teamBName, 3);
      add(n.teamAName, 0);
    } else {
      add(n.teamAName, 1);
      add(n.teamBName, 1);
    }
  }
  let champion = "";
  let best = -1;
  for (const [name, pts] of points) {
    if (pts > best) {
      best = pts;
      champion = name;
    }
  }
  await finishTournament(tx, tournamentId, champion);
}
