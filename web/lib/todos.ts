import { MatchStatus } from "@/lib/generated/prisma";
import type { AccessibleOrg } from "@/lib/auth-session";
import { isStaffRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export type TodoSummary = {
  total: number;
  staffTotal: number;
  playerTotal: number;
  staff: {
    disputedMatches: number;
    pendingScoreReports: number;
    pendingRosterSubmissions: number;
    pendingEvidence: number;
    dueReminders: number;
    claimableMatches: number;
  };
  player: {
    checkinsNeeded: number;
    liveMatches: number;
    activeTurns: number;
    announcements: number;
  };
};

export type TodoItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  kind: "staff" | "player";
};

const emptyStaff = {
  disputedMatches: 0,
  pendingScoreReports: 0,
  pendingRosterSubmissions: 0,
  pendingEvidence: 0,
  dueReminders: 0,
  claimableMatches: 0,
};

const emptyPlayer = {
  checkinsNeeded: 0,
  liveMatches: 0,
  activeTurns: 0,
  announcements: 0,
};

function emptySummary(): TodoSummary {
  return {
    total: 0,
    staffTotal: 0,
    playerTotal: 0,
    staff: { ...emptyStaff },
    player: { ...emptyPlayer },
  };
}

async function getProfileId(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "discord" },
    select: { accountId: true },
  });
  if (!account?.accountId) return null;
  const profile = await prisma.userProfile.findUnique({
    where: { discordUserId: account.accountId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

function activeOrgFrom(orgs: AccessibleOrg[], activeOrgId: string | null) {
  return orgs.find((org) => org.id === activeOrgId) ?? orgs[0] ?? null;
}

function activeMatchStatuses() {
  return [MatchStatus.PENDING, MatchStatus.VETO, MatchStatus.LIVE];
}

function linkedTeamWhere(profileId: string) {
  return {
    OR: [
      { captainProfileId: profileId },
      { members: { some: { userProfileId: profileId } } },
    ],
  };
}

function staffMatchWhere(organizationId: string, profileId: string | null) {
  return {
    organizationId,
    ...(profileId
      ? {
          participants: {
            none: { team: linkedTeamWhere(profileId) },
          },
        }
      : {}),
  };
}

const TEAM_ACTION_ROLES = new Set(["captain", "coach", "manager", "team_leader"]);

function otherTeamSlot(slot: string) {
  return slot === "teamB" ? "teamA" : "teamB";
}

function nextVetoTurn(match: {
  bestOf: number;
  vetoMode: string;
  vetoStartingTeam: string;
  mapPool: unknown;
  finalMap: string | null;
  vetoActions: Array<{ kind: string; teamSlot: string; mapName: string }>;
}) {
  if (match.finalMap) return null;
  const picks = match.vetoActions.filter((action) => action.kind === "PICK");
  const bans = match.vetoActions.filter((action) => action.kind === "BAN");
  const startingTeam = match.vetoStartingTeam === "teamB" ? "teamB" : "teamA";
  const turnFor = (count: number) =>
    count % 2 === 0 ? startingTeam : otherTeamSlot(startingTeam);

  if (match.vetoMode === "series_picks" || match.vetoMode === "manual_picks") {
    const mapCount = Array.isArray(match.mapPool) ? match.mapPool.length : 0;
    if (
      match.vetoMode === "series_picks" &&
      picks.length >= Math.min(match.bestOf, mapCount)
    ) {
      return null;
    }
    return turnFor(picks.length);
  }

  return turnFor(bans.length + picks.length);
}

function teamSlotsForProfile(
  profileId: string,
  participants: Array<{
    slot: string;
    team: {
      captainProfileId: string | null;
      members: Array<{ userProfileId: string | null; teamRole: string }>;
    };
  }>,
) {
  return participants
    .filter(
      (participant) =>
        participant.team.captainProfileId === profileId ||
        participant.team.members.some(
          (member) =>
            member.userProfileId === profileId &&
            TEAM_ACTION_ROLES.has(member.teamRole),
        ),
    )
    .map((participant) => participant.slot);
}

async function teamRolesForProfile(organizationId: string, profileId: string | null) {
  if (!profileId) return new Set<string>();

  const [captainedTeams, memberships] = await Promise.all([
    prisma.team.findMany({
      where: { organizationId, captainProfileId: profileId },
      select: { id: true },
    }),
    prisma.teamMember.findMany({
      where: {
        userProfileId: profileId,
        team: { organizationId },
      },
      select: { teamRole: true },
    }),
  ]);

  const roles = new Set(memberships.map((member) => member.teamRole));
  if (captainedTeams.length) roles.add("team_leader");
  return roles;
}

function announcementWhere(organizationId: string) {
  return {
    organizationId,
    archivedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

function matchesAnnouncementTarget(
  announcement: {
    targetKind: string;
    targetValue: string | null;
  },
  activeOrg: AccessibleOrg,
  teamRoles: Set<string>,
) {
  const isOrgPlayer = activeOrg.role === "PLAYER" || teamRoles.size > 0;
  if (announcement.targetKind === "everyone") return true;
  if (announcement.targetKind === "staff") return isStaffRole(activeOrg.role);
  if (announcement.targetKind === "players") return isOrgPlayer;
  if (announcement.targetKind === "org_role") {
    return announcement.targetValue === activeOrg.role;
  }
  if (announcement.targetKind === "team_role") {
    return Boolean(announcement.targetValue && teamRoles.has(announcement.targetValue));
  }
  return false;
}

function effectiveClaimMode(match: {
  refereeClaimMode: string;
  tournament: { refereeClaimMode: string; refereeClaimLimit: number } | null;
}) {
  return match.refereeClaimMode === "tournament"
    ? match.tournament?.refereeClaimMode ?? "open"
    : match.refereeClaimMode;
}

function effectiveClaimLimit(match: {
  refereeClaimMode: string;
  refereeClaimLimit: number;
  tournament: { refereeClaimMode: string; refereeClaimLimit: number } | null;
}) {
  return Math.max(
    1,
    match.refereeClaimMode === "tournament"
      ? match.tournament?.refereeClaimLimit ?? match.refereeClaimLimit
      : match.refereeClaimLimit,
  );
}

export async function getTodoSummary(
  userId: string,
  orgs: AccessibleOrg[],
  activeOrgId: string | null,
): Promise<TodoSummary> {
  const activeOrg = activeOrgFrom(orgs, activeOrgId);
  if (!activeOrg) return emptySummary();

  const profileId = await getProfileId(userId);
  const staff = isStaffRole(activeOrg.role)
    ? await getStaffTodoCounts(activeOrg.id, profileId)
    : { ...emptyStaff };
  const player = profileId
    ? await getPlayerTodoCounts(activeOrg, profileId)
    : { ...emptyPlayer };
  const staffTotal =
    staff.disputedMatches +
    staff.pendingScoreReports +
    staff.pendingRosterSubmissions +
    staff.pendingEvidence +
    staff.dueReminders +
    staff.claimableMatches;
  const playerTotal =
    player.checkinsNeeded +
    player.liveMatches +
    player.activeTurns +
    player.announcements;

  return {
    total: staffTotal + playerTotal,
    staffTotal,
    playerTotal,
    staff,
    player,
  };
}

async function getStaffTodoCounts(organizationId: string, profileId: string | null) {
  const now = new Date();
  const staffWhere = staffMatchWhere(organizationId, profileId);
  const [
    disputedMatches,
    pendingScoreReports,
    pendingRosterSubmissions,
    pendingEvidence,
    dueReminders,
    claimableMatchRows,
  ] = await Promise.all([
    prisma.match.count({
      where: { ...staffWhere, status: MatchStatus.DISPUTED },
    }),
    prisma.scoreReport.count({
      where: { organizationId, status: "pending", match: staffWhere },
    }),
    prisma.rosterSubmission.count({
      where: { organizationId, status: "submitted", match: staffWhere },
    }),
    prisma.evidence.count({
      where: { organizationId, status: "submitted", match: staffWhere },
    }),
    prisma.scheduledReminder.count({
      where: {
        organizationId,
        deliveredAt: null,
        dueAt: { lte: now },
        OR: [{ matchId: null }, { match: staffWhere }],
      },
    }),
    prisma.match.findMany({
      where: {
        ...staffWhere,
        status: { in: activeMatchStatuses() },
        refereeClaimMode: { in: ["open", "tournament"] },
        ...(profileId
          ? {
              refereeAssignments: {
                none: { userProfileId: profileId, status: "active" },
              },
            }
          : {}),
      },
      select: {
        refereeClaimMode: true,
        refereeClaimLimit: true,
        tournament: {
          select: { refereeClaimMode: true, refereeClaimLimit: true },
        },
        refereeAssignments: {
          where: { status: "active" },
          select: { id: true },
        },
      },
      take: 100,
    }),
  ]);
  const claimableMatches = claimableMatchRows.filter(
    (match) =>
      effectiveClaimMode(match) === "open" &&
      match.refereeAssignments.length < effectiveClaimLimit(match),
  ).length;

  return {
    disputedMatches,
    pendingScoreReports,
    pendingRosterSubmissions,
    pendingEvidence,
    dueReminders,
    claimableMatches,
  };
}

async function getPlayerTodoCounts(activeOrg: AccessibleOrg, profileId: string) {
  const organizationId = activeOrg.id;
  const [checkinsNeeded, liveMatches, turnMatches, announcements, teamRoles] =
    await Promise.all([
      prisma.match.count({
        where: {
          organizationId,
          status: { in: activeMatchStatuses() },
          participants: { some: { team: linkedTeamWhere(profileId) } },
          checkins: { none: { userProfileId: profileId } },
        },
      }),
      prisma.match.count({
        where: {
          organizationId,
          status: { in: [MatchStatus.VETO, MatchStatus.LIVE] },
          participants: { some: { team: linkedTeamWhere(profileId) } },
        },
      }),
      prisma.match.findMany({
        where: {
          organizationId,
          status: MatchStatus.VETO,
          participants: { some: { team: linkedTeamWhere(profileId) } },
        },
        select: {
          bestOf: true,
          vetoMode: true,
          vetoStartingTeam: true,
          mapPool: true,
          finalMap: true,
          vetoActions: {
            orderBy: { createdAt: "asc" },
            select: { kind: true, teamSlot: true, mapName: true },
          },
          participants: {
            select: {
              slot: true,
              team: {
                select: {
                  captainProfileId: true,
                  members: { select: { userProfileId: true, teamRole: true } },
                },
              },
            },
          },
        },
        take: 100,
      }),
      prisma.announcement.findMany({
        where: announcementWhere(organizationId),
        select: { targetKind: true, targetValue: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      teamRolesForProfile(organizationId, profileId),
    ]);

  const activeTurns = turnMatches.filter((match) => {
    const turn = nextVetoTurn(match);
    if (!turn) return false;
    return teamSlotsForProfile(profileId, match.participants).includes(turn);
  }).length;
  const scopedAnnouncements = announcements.filter((announcement) =>
    matchesAnnouncementTarget(announcement, activeOrg, teamRoles),
  ).length;

  return {
    checkinsNeeded,
    liveMatches,
    activeTurns,
    announcements: scopedAnnouncements,
  };
}

export async function getTodoItems(
  userId: string,
  orgs: AccessibleOrg[],
  activeOrgId: string | null,
  mode: "staff" | "player" | "all" = "all",
): Promise<{ summary: TodoSummary; items: TodoItem[] }> {
  const activeOrg = activeOrgFrom(orgs, activeOrgId);
  if (!activeOrg) return { summary: emptySummary(), items: [] };
  const summary = await getTodoSummary(userId, orgs, activeOrg.id);
  const profileId = await getProfileId(userId);
  const items: TodoItem[] = [];

  if (mode !== "player" && isStaffRole(activeOrg.role)) {
    const staffWhere = staffMatchWhere(activeOrg.id, profileId);
    const [
      disputedMatches,
      scoreReports,
      rosterSubmissions,
      evidence,
      reminders,
      claimableMatches,
    ] = await Promise.all([
      prisma.match.findMany({
        where: { ...staffWhere, status: MatchStatus.DISPUTED },
        select: { id: true, publicCode: true, teamAName: true, teamBName: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.scoreReport.findMany({
        where: { organizationId: activeOrg.id, status: "pending", match: staffWhere },
        select: {
          id: true,
          match: { select: { publicCode: true, teamAName: true, teamBName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.rosterSubmission.findMany({
        where: { organizationId: activeOrg.id, status: "submitted", match: staffWhere },
        select: {
          id: true,
          teamName: true,
          match: { select: { publicCode: true, teamAName: true, teamBName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.evidence.findMany({
        where: { organizationId: activeOrg.id, status: "submitted", match: staffWhere },
        select: {
          id: true,
          match: { select: { publicCode: true, teamAName: true, teamBName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.scheduledReminder.findMany({
        where: {
          organizationId: activeOrg.id,
          deliveredAt: null,
          dueAt: { lte: new Date() },
          OR: [{ matchId: null }, { match: staffWhere }],
        },
        select: {
          id: true,
          kind: true,
          match: { select: { publicCode: true, teamAName: true, teamBName: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 6,
      }),
      prisma.match.findMany({
        where: {
          ...staffWhere,
          status: { in: activeMatchStatuses() },
          refereeClaimMode: { in: ["open", "tournament"] },
          ...(profileId
            ? {
                refereeAssignments: {
                  none: { userProfileId: profileId, status: "active" },
                },
              }
            : {}),
        },
        select: {
          id: true,
          publicCode: true,
          teamAName: true,
          teamBName: true,
          refereeClaimMode: true,
          refereeClaimLimit: true,
          tournament: {
            select: { refereeClaimMode: true, refereeClaimLimit: true },
          },
          refereeAssignments: {
            where: { status: "active" },
            select: { id: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
    ]);

    for (const match of disputedMatches) {
      items.push({
        id: `match-${match.id}`,
        kind: "staff",
        title: "Dispute needs review",
        description: `${match.teamAName} vs ${match.teamBName}`,
        href: `/matches/${match.publicCode}`,
      });
    }
    for (const report of scoreReports) {
      items.push({
        id: `score-${report.id}`,
        kind: "staff",
        title: "Score report pending",
        description: `${report.match.teamAName} vs ${report.match.teamBName}`,
        href: `/matches/${report.match.publicCode}`,
      });
    }
    for (const roster of rosterSubmissions) {
      items.push({
        id: `roster-${roster.id}`,
        kind: "staff",
        title: "Roster needs approval",
        description: `${roster.teamName} for ${roster.match.teamAName} vs ${roster.match.teamBName}`,
        href: `/matches/${roster.match.publicCode}`,
      });
    }
    for (const item of evidence) {
      items.push({
        id: `evidence-${item.id}`,
        kind: "staff",
        title: "Evidence needs review",
        description: `${item.match.teamAName} vs ${item.match.teamBName}`,
        href: `/matches/${item.match.publicCode}`,
      });
    }
    for (const reminder of reminders) {
      items.push({
        id: `reminder-${reminder.id}`,
        kind: "staff",
        title: "Reminder due",
        description: reminder.match
          ? `${reminder.kind} for ${reminder.match.teamAName} vs ${reminder.match.teamBName}`
          : reminder.kind,
        href: reminder.match ? `/matches/${reminder.match.publicCode}` : "/dashboard",
      });
    }
    for (const match of claimableMatches) {
      if (
        effectiveClaimMode(match) !== "open" ||
        match.refereeAssignments.length >= effectiveClaimLimit(match)
      ) {
        continue;
      }
      items.push({
        id: `claim-${match.id}`,
        kind: "staff",
        title: "Referee slot open",
        description: `${match.teamAName} vs ${match.teamBName}`,
        href: `/matches/${match.publicCode}`,
      });
    }
  }

  if (mode !== "staff" && profileId) {
    const [checkins, liveMatches, turnMatches, announcements, teamRoles] =
      await Promise.all([
        prisma.match.findMany({
          where: {
            organizationId: activeOrg.id,
            status: { in: activeMatchStatuses() },
            participants: { some: { team: linkedTeamWhere(profileId) } },
            checkins: { none: { userProfileId: profileId } },
          },
          select: { id: true, publicCode: true, teamAName: true, teamBName: true },
          orderBy: { updatedAt: "desc" },
          take: 8,
        }),
        prisma.match.findMany({
          where: {
            organizationId: activeOrg.id,
            status: { in: [MatchStatus.VETO, MatchStatus.LIVE] },
            participants: { some: { team: linkedTeamWhere(profileId) } },
          },
          select: { id: true, publicCode: true, teamAName: true, teamBName: true, status: true },
          orderBy: { updatedAt: "desc" },
          take: 8,
        }),
        prisma.match.findMany({
          where: {
            organizationId: activeOrg.id,
            status: MatchStatus.VETO,
            participants: { some: { team: linkedTeamWhere(profileId) } },
          },
          select: {
            id: true,
            publicCode: true,
            teamAName: true,
            teamBName: true,
            bestOf: true,
            vetoMode: true,
            vetoStartingTeam: true,
            mapPool: true,
            finalMap: true,
            vetoActions: {
              orderBy: { createdAt: "asc" },
              select: { kind: true, teamSlot: true, mapName: true },
            },
            participants: {
              select: {
                slot: true,
                team: {
                  select: {
                    captainProfileId: true,
                    members: { select: { userProfileId: true, teamRole: true } },
                  },
                },
              },
            },
          },
          take: 20,
        }),
        prisma.announcement.findMany({
          where: announcementWhere(activeOrg.id),
          select: {
            id: true,
            title: true,
            body: true,
            targetKind: true,
            targetValue: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
        teamRolesForProfile(activeOrg.id, profileId),
      ]);

    for (const match of checkins) {
      items.push({
        id: `checkin-${match.id}`,
        kind: "player",
        title: "Check-in needed",
        description: `${match.teamAName} vs ${match.teamBName}`,
        href: "/player/checkins",
      });
    }
    for (const match of liveMatches) {
      items.push({
        id: `live-${match.id}`,
        kind: "player",
        title: match.status === MatchStatus.VETO ? "Veto is live" : "Match is live",
        description: `${match.teamAName} vs ${match.teamBName}`,
        href: `/matches/${match.publicCode}`,
      });
    }
    for (const match of turnMatches) {
      const turn = nextVetoTurn(match);
      if (!turn || !teamSlotsForProfile(profileId, match.participants).includes(turn)) {
        continue;
      }
      items.push({
        id: `turn-${match.id}`,
        kind: "player",
        title: "Your team has the current veto turn",
        description: `${match.teamAName} vs ${match.teamBName}`,
        href: `/matches/${match.publicCode}`,
      });
    }
    for (const announcement of announcements) {
      if (!matchesAnnouncementTarget(announcement, activeOrg, teamRoles)) {
        continue;
      }
      items.push({
        id: `announcement-${announcement.id}`,
        kind: "player",
        title: announcement.title,
        description: announcement.body,
        href: "/notifications",
      });
    }
  }

  return { summary, items: items.slice(0, 24) };
}
