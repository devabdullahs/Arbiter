import { notFound } from "next/navigation";

import { NoOrgAccess, PageHeader, StatusBadge } from "@/components/dashboard-ui";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAccessContext } from "@/lib/auth-session";
import { formatDateTime } from "@/lib/format-date";
import { OrgMemberRole } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

import { MatchActionsPanel } from "./match-actions-panel";
import { MatchLiveSync } from "./match-live-sync";
import {
  submitTeamCharacterBanAction,
  submitTeamVetoAction,
  assignWebReferee,
  claimWebRefereeAssignment,
  removeWebRefereeAssignment,
  updateWebRefereeClaimSettings,
  updateWebScoreReport,
} from "./actions";
import { VetoCountdown } from "./veto-countdown";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { RESULT_LABEL_OPTIONS, formatScore, scoreSide } from "@/lib/score-format";

function fmt(date: Date) {
  return formatDateTime(date);
}

type MapEntry = string | { map?: string; mode?: string };

type VetoActionView = {
  id: string;
  kind: string;
  teamSlot: string;
  mapName: string;
  source?: string;
  note?: string | null;
};

function mapNameOf(entry: MapEntry) {
  return typeof entry === "string" ? entry : entry.map ?? "";
}

function mapModeOf(entry: MapEntry) {
  return typeof entry === "string" ? null : entry.mode ?? null;
}

function normalizeMapPool(mapPool: MapEntry[]) {
  return mapPool
    .map((entry) => ({ name: mapNameOf(entry), mode: mapModeOf(entry) }))
    .filter((entry) => entry.name);
}

function teamDisplay(slot: string, teamAName: string, teamBName: string) {
  if (slot === "teamA") return teamAName;
  if (slot === "teamB") return teamBName;
  return slot;
}

function otherTeamSlot(slot: string) {
  return slot === "teamB" ? "teamA" : "teamB";
}

function nextVetoState({
  bestOf,
  vetoMode,
  vetoStartingTeam,
  mapPool,
  vetoActions,
}: {
  bestOf: number;
  vetoMode: string;
  vetoStartingTeam: string;
  mapPool: MapEntry[];
  vetoActions: VetoActionView[];
}) {
  const picks = vetoActions.filter((action) => action.kind === "PICK");
  const bans = vetoActions.filter((action) => action.kind === "BAN");
  const startingTeam = vetoStartingTeam === "teamB" ? "teamB" : "teamA";
  const turnFor = (count: number) =>
    count % 2 === 0 ? startingTeam : otherTeamSlot(startingTeam);

  if (vetoMode === "series_picks" || vetoMode === "manual_picks") {
    return {
      kind: "PICK",
      teamSlot: turnFor(picks.length),
      complete:
        vetoMode === "series_picks" &&
        picks.length >= Math.min(bestOf, mapPool.length),
    };
  }

  const bansNeeded = Math.max(0, mapPool.length - bestOf);
  return {
    kind: bans.length < bansNeeded ? "BAN" : "PICK",
    teamSlot: turnFor(bans.length + picks.length),
    complete: false,
  };
}

function vetoActionSummary(
  action: VetoActionView,
  teamAName: string,
  teamBName: string,
) {
  const team = teamDisplay(action.teamSlot, teamAName, teamBName);
  const kind = action.kind.toLowerCase();
  if (action.mapName === "__TURN_SKIPPED__") {
    return `${team} skipped ${kind} turn`;
  }
  return `${team} ${kind === "pick" ? "picked" : "banned"} ${action.mapName}`;
}

const REF_ASSIGNABLE_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.OWNER,
  OrgMemberRole.ADMIN,
  OrgMemberRole.MANAGER,
  OrgMemberRole.HEAD_REF,
  OrgMemberRole.REFEREE,
]);

const REF_ASSIGNMENT_MANAGER_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.OWNER,
  OrgMemberRole.ADMIN,
  OrgMemberRole.MANAGER,
  OrgMemberRole.HEAD_REF,
]);

function effectiveRefereeClaimMode(match: {
  refereeClaimMode: string;
  tournament: { refereeClaimMode: string; refereeClaimLimit: number } | null;
}) {
  return match.refereeClaimMode === "tournament"
    ? match.tournament?.refereeClaimMode ?? "open"
    : match.refereeClaimMode;
}

function effectiveRefereeClaimLimit(match: {
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

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const ctx = await getAccessContext();
  if (!ctx) return null;

  const viewerProfile = ctx.discordId
    ? await prisma.userProfile.findUnique({
        where: { discordUserId: ctx.discordId },
        select: { id: true },
      })
    : null;
  const accessFilters = [
    ...(ctx.orgIds.length ? [{ organizationId: { in: ctx.orgIds } }] : []),
    ...(viewerProfile
      ? [
          {
            participants: {
              some: {
                team: {
                  OR: [
                    { captainProfileId: viewerProfile.id },
                    { members: { some: { userProfileId: viewerProfile.id } } },
                  ],
                },
              },
            },
          },
        ]
      : []),
  ];

  if (accessFilters.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Match" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const match = await prisma.match.findFirst({
    where: {
      publicCode: code.toUpperCase(),
      OR: accessFilters,
    },
    include: {
      vetoActions: { orderBy: { createdAt: "asc" } },
      characterBanActions: { orderBy: { createdAt: "asc" } },
      mapResults: { orderBy: { mapIndex: "asc" } },
      scoreReports: { orderBy: { createdAt: "desc" } },
      pauseLogs: { orderBy: { createdAt: "desc" } },
      warnings: { orderBy: { createdAt: "desc" } },
      evidence: { orderBy: { createdAt: "desc" } },
      rosterSubmissions: { orderBy: { teamSlot: "asc" } },
      refereeAssignments: {
        where: { status: "active" },
        include: {
          userProfile: {
            select: { id: true, displayName: true, discordUserId: true },
          },
          assignedBy: {
            select: { displayName: true, discordUserId: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      checkins: {
        include: {
          userProfile: {
            select: { id: true, displayName: true, discordUserId: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      participants: {
        include: {
          team: {
            include: {
              members: {
                include: {
                  userProfile: {
                    select: { id: true, displayName: true, discordUserId: true },
                  },
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
        orderBy: { slot: "asc" },
      },
      organization: {
        select: {
          discordGuildId: true,
          name: true,
          members: {
            where: {
              role: {
                in: [
                  OrgMemberRole.OWNER,
                  OrgMemberRole.ADMIN,
                  OrgMemberRole.MANAGER,
                  OrgMemberRole.HEAD_REF,
                  OrgMemberRole.REFEREE,
                ],
              },
            },
            include: {
              userProfile: {
                select: { id: true, displayName: true, discordUserId: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          rulesPresets: {
            orderBy: { label: "asc" },
            select: {
              id: true,
              key: true,
              label: true,
              gameTitle: true,
              mapPool: true,
              characterPool: true,
            },
          },
        },
      },
      tournament: {
        select: {
          refereeClaimMode: true,
          refereeClaimLimit: true,
        },
      },
    },
  });

  if (!match) notFound();
  const activeOrgRole =
    ctx.orgs.find((org) => org.id === match.organizationId)?.role ?? null;
  const viewerIsParticipant = Boolean(
    viewerProfile &&
      match.participants.some(
        (participant) =>
          participant.team.captainProfileId === viewerProfile.id ||
          participant.team.members.some(
            (member) => member.userProfileId === viewerProfile.id,
          ),
      ),
  );
  const canManageOrg = ctx.orgIds.includes(match.organizationId);
  const canManage = canManageOrg && !viewerIsParticipant;
  const canManageRefAssignments = Boolean(
    canManage &&
      activeOrgRole &&
      REF_ASSIGNMENT_MANAGER_ROLES.has(activeOrgRole),
  );
  const canClaimReferee = Boolean(
    canManageOrg &&
      !viewerIsParticipant &&
      activeOrgRole &&
      REF_ASSIGNABLE_ROLES.has(activeOrgRole),
  );
  const viewerAssignment = viewerProfile
    ? match.refereeAssignments.find(
        (assignment) => assignment.userProfileId === viewerProfile.id,
      )
    : null;
  const effectiveClaimMode = effectiveRefereeClaimMode(match);
  const effectiveClaimLimit = effectiveRefereeClaimLimit(match);
  const latestCheckinByProfile = new Map<string, (typeof match.checkins)[number]>();
  for (const checkin of match.checkins) {
    if (!latestCheckinByProfile.has(checkin.userProfileId)) {
      latestCheckinByProfile.set(checkin.userProfileId, checkin);
    }
  }
  const linkedRosterCount = match.participants.reduce(
    (count, participant) =>
      count +
      participant.team.members.filter((member) => Boolean(member.userProfileId)).length,
    0,
  );
  const checkedInCount = new Set(match.checkins.map((checkin) => checkin.userProfileId)).size;
  const participantLabel = (slot: string, fallback: string) => {
    if (slot === "teamA") return match.teamAName;
    if (slot === "teamB") return match.teamBName;
    return fallback;
  };
  const viewerTeamSlots = viewerProfile
    ? match.participants
        .filter(
          (participant) =>
            participant.team.captainProfileId === viewerProfile.id ||
            participant.team.members.some(
              (member) =>
                member.userProfileId === viewerProfile.id &&
                ["coach", "manager", "team_leader"].includes(member.teamRole),
            ),
        )
        .map((participant) => participant.slot)
    : [];
  const liveVersion = [
    match.status,
    match.updatedAt.toISOString(),
    match.vetoActions.at(-1)?.createdAt.toISOString() ?? "no-veto",
    match.characterBanActions.at(-1)?.createdAt.toISOString() ?? "no-character-ban",
    match.scoreReports.at(0)?.createdAt.toISOString() ?? "no-score",
    match.evidence.at(0)?.createdAt.toISOString() ?? "no-evidence",
    match.mapResults.at(-1)?.updatedAt.toISOString() ?? "no-maps",
    match.checkins.at(0)?.createdAt.toISOString() ?? "no-checkins",
    match.refereeAssignments.at(-1)?.updatedAt.toISOString() ?? "no-refs",
    String(match.mapResults.length),
  ].join(":");
  const turnStartedAt =
    match.finalMap || nextVetoState({
      bestOf: match.bestOf,
      vetoMode: match.vetoMode,
      vetoStartingTeam: match.vetoStartingTeam,
      mapPool: Array.isArray(match.mapPool) ? (match.mapPool as MapEntry[]) : [],
      vetoActions: match.vetoActions.map((action) => ({
        id: action.id,
        kind: action.kind,
        teamSlot: action.teamSlot,
        mapName: action.mapName,
      })),
    }).complete
      ? null
      : (match.vetoActions.at(-1)?.createdAt ?? (match.status === "VETO" ? match.updatedAt : null))
          ?.toISOString() ?? null;

  return (
    <div className="space-y-6">
      <MatchLiveSync code={match.publicCode} version={liveVersion} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={`${match.teamAName} vs ${match.teamBName}`}
          description={`Bo${match.bestOf} / ${match.rulesPreset} / created ${fmt(match.createdAt)}`}
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl tabular-nums">
            {formatScore(
              match.teamAScore,
              match.teamBScore,
              match.teamAResult,
              match.teamBResult,
            )}
          </span>
          <StatusBadge status={match.status} />
        </div>
      </div>

      {match.status === "DISPUTED" && match.disputeReason ? (
        <Card>
          <CardContent className="text-destructive py-3 text-sm">
            Dispute: {match.disputeReason}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">Pre-match status</h2>
              <p className="text-muted-foreground text-sm">
                Players check in from the player dashboard using match code{" "}
                <span className="font-mono">{match.publicCode}</span>.
              </p>
            </div>
            {match.participants.length === 0 ? (
              <Badge variant="outline">Teams not linked</Badge>
            ) : linkedRosterCount > 0 && checkedInCount >= linkedRosterCount ? (
              <Badge>Ready</Badge>
            ) : (
              <Badge variant="outline">Waiting for check-ins</Badge>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Linked teams</p>
              <p className="text-lg font-semibold tabular-nums">
                {match.participants.length}/2
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Player check-ins</p>
              <p className="text-lg font-semibold tabular-nums">
                {checkedInCount}/{linkedRosterCount || 0}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Roster lock</p>
              <p className="text-sm font-medium">
                {match.rosterLockedAt ? fmt(match.rosterLockedAt) : "Not locked"}
              </p>
            </div>
          </div>
          {match.participants.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              This match was created with custom names. Create future matches by
              selecting registered teams to unlock roster and check-in tracking.
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {match.participants.map((participant) => {
                const linkedMembers = participant.team.members.filter((member) =>
                  Boolean(member.userProfileId),
                );
                const teamCheckins = linkedMembers.filter((member) =>
                  member.userProfileId
                    ? latestCheckinByProfile.has(member.userProfileId)
                    : false,
                ).length;
                return (
                  <div key={participant.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">
                        {participantLabel(participant.slot, participant.team.name)}
                      </p>
                      <Badge variant="outline">
                        {teamCheckins}/{linkedMembers.length} checked in
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Registered as {participant.team.name}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <LiveVetoOverview
        teamAName={match.teamAName}
        teamBName={match.teamBName}
        bestOf={match.bestOf}
        status={match.status}
        vetoMode={match.vetoMode}
        vetoStartingTeam={match.vetoStartingTeam}
        vetoTimerSeconds={match.vetoTimerSeconds}
        vetoTimeoutAction={match.vetoTimeoutAction}
        finalMap={match.finalMap}
        turnStartedAt={turnStartedAt}
        code={match.publicCode}
        mapPool={
          Array.isArray(match.mapPool)
            ? (match.mapPool as MapEntry[])
            : []
        }
        viewerTeamSlots={viewerTeamSlots}
        vetoActions={match.vetoActions.map((action) => ({
          id: action.id,
          kind: action.kind,
          teamSlot: action.teamSlot,
          mapName: action.mapName,
          source: action.source,
          note: action.note,
        }))}
      />

      {match.characterBanMode !== "none" ? (
        <LiveCharacterBans
          code={match.publicCode}
          teamAName={match.teamAName}
          teamBName={match.teamBName}
          status={match.status}
          characterBanMode={match.characterBanMode}
          characterBanStarted={Boolean(match.characterBanStartedAt)}
          vetoStartingTeam={match.vetoStartingTeam}
          characterPool={
            Array.isArray(match.characterPool)
              ? (match.characterPool as MapEntry[])
              : []
          }
          viewerTeamSlots={viewerTeamSlots}
          characterBanActions={match.characterBanActions.map((action) => ({
            id: action.id,
            teamSlot: action.teamSlot,
            action: action.action,
            character: action.character,
            gameRole: action.gameRole,
            source: action.source,
          }))}
        />
      ) : null}

      <RefereeAssignmentPanel
        code={match.publicCode}
        claimMode={match.refereeClaimMode}
        effectiveClaimMode={effectiveClaimMode}
        claimLimit={match.refereeClaimLimit}
        effectiveClaimLimit={effectiveClaimLimit}
        canClaim={canClaimReferee && !viewerAssignment}
        canManage={canManageRefAssignments}
        assignedCount={match.refereeAssignments.length}
        assignments={match.refereeAssignments.map((assignment) => ({
          id: assignment.id,
          source: assignment.source,
          createdAt: assignment.createdAt,
          userProfile: assignment.userProfile,
          assignedBy: assignment.assignedBy,
        }))}
        availableReferees={match.organization.members
          .filter(
            (member) =>
              REF_ASSIGNABLE_ROLES.has(member.role) &&
              !match.participants.some(
                (participant) =>
                  participant.team.captainProfileId === member.userProfileId ||
                  participant.team.members.some(
                    (teamMember) =>
                      teamMember.userProfileId === member.userProfileId,
                  ),
              ),
          )
          .map((member) => ({
            userProfileId: member.userProfileId,
            role: member.role,
            displayName:
              member.userProfile.displayName ?? member.userProfile.discordUserId,
          }))}
      />

      {viewerIsParticipant && canManageOrg ? (
        <Card>
          <CardContent className="text-muted-foreground py-4 text-sm">
            You have an operational role in this org, but this account is linked
            to a team in this match. Arbiter is showing the player/team view and
            hiding referee controls for conflict-of-interest safety.
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium">Web controls</h2>
                <p className="text-muted-foreground text-sm">
                  Changes are saved to Arbiter and queued for Discord refresh when
                  this match has Discord messages.
                </p>
              </div>
              {match.channelId ? (
                <a
                  href={`https://discord.com/channels/${match.organization.discordGuildId}/${match.channelId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm hover:underline"
                >
                  Open Discord room
                </a>
              ) : (
                <Badge variant="outline">Not enabled in Discord</Badge>
              )}
            </div>
            <MatchActionsPanel
              code={match.publicCode}
              teamAName={match.teamAName}
              teamBName={match.teamBName}
              teamAScore={match.teamAScore}
              teamBScore={match.teamBScore}
              teamAResult={match.teamAResult}
              teamBResult={match.teamBResult}
              bestOf={match.bestOf}
              rulesPreset={match.rulesPreset}
              rulesPresets={match.organization.rulesPresets.map((preset) => ({
                id: preset.id,
                key: preset.key,
                label: preset.label,
                gameTitle: preset.gameTitle,
                mapCount: Array.isArray(preset.mapPool)
                  ? preset.mapPool.length
                  : 0,
                characterCount: Array.isArray(preset.characterPool)
                  ? preset.characterPool.length
                  : 0,
              }))}
              status={match.status}
              vetoMode={match.vetoMode}
              vetoStartingTeam={match.vetoStartingTeam}
              vetoTimerSeconds={match.vetoTimerSeconds}
              vetoTimeoutAction={match.vetoTimeoutAction}
              characterBanMode={match.characterBanMode}
              characterBanStarted={Boolean(match.characterBanStartedAt)}
              characterBanTimerSeconds={match.characterBanTimerSeconds}
              characterPool={
                Array.isArray(match.characterPool)
                  ? (match.characterPool as Array<string | { map?: string; mode?: string }>)
                  : []
              }
              mapPool={
                Array.isArray(match.mapPool)
                  ? (match.mapPool as Array<string | { map?: string; mode?: string }>)
                  : []
              }
              finalMap={match.finalMap}
              turnStartedAt={turnStartedAt}
              vetoActions={match.vetoActions.map((action) => ({
                id: action.id,
                kind: action.kind,
                teamSlot: action.teamSlot,
                mapName: action.mapName,
                source: action.source,
              }))}
              characterBanActions={match.characterBanActions.map((action) => ({
                id: action.id,
                teamSlot: action.teamSlot,
                action: action.action,
                character: action.character,
                gameRole: action.gameRole,
                source: action.source,
              }))}
              mapResults={match.mapResults.map((map) => ({
                id: map.id,
                mapIndex: map.mapIndex,
                mapName: map.mapName,
                teamAScore: map.teamAScore,
                teamBScore: map.teamBScore,
                teamAResult: map.teamAResult,
                teamBResult: map.teamBResult,
                status: map.status,
              }))}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-4 text-sm">
            Player view: match information and logs are visible here. Referee
            controls are hidden unless you are assigned as organization staff.
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="prematch">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="prematch">
            Check-ins ({match.checkins.length})
          </TabsTrigger>
          <TabsTrigger value="veto">Veto ({match.vetoActions.length})</TabsTrigger>
          <TabsTrigger value="characters">
            Characters ({match.characterBanActions.length})
          </TabsTrigger>
          <TabsTrigger value="maps">
            Maps ({match.mapResults.length})
          </TabsTrigger>
          <TabsTrigger value="scores">
            Scores ({match.scoreReports.length})
          </TabsTrigger>
          <TabsTrigger value="pauses">
            Pauses ({match.pauseLogs.length})
          </TabsTrigger>
          <TabsTrigger value="warnings">
            Warnings ({match.warnings.length})
          </TabsTrigger>
          <TabsTrigger value="evidence">
            Evidence ({match.evidence.length})
          </TabsTrigger>
          <TabsTrigger value="rosters">
            Rosters ({match.rosterSubmissions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prematch">
          <SimpleTable
            head={["Team", "Player", "Game account", "Status", "When"]}
            rows={match.participants.flatMap((participant) =>
              participant.team.members.map((member) => {
                const checkin = member.userProfileId
                  ? latestCheckinByProfile.get(member.userProfileId)
                  : null;
                return [
                  participantLabel(participant.slot, participant.team.name),
                  member.displayName,
                  checkin?.gameAccount ?? "-",
                  checkin ? "Checked in" : "Missing",
                  checkin ? fmt(checkin.createdAt) : "-",
                ];
              }),
            )}
            empty="No linked roster members for check-in tracking."
          />
        </TabsContent>

        <TabsContent value="veto">
          <SimpleTable
            head={["Order", "Action", "Team", "Map", "Source"]}
            rows={match.vetoActions.map((v, i) => [
              String(i + 1),
              v.kind,
              participantLabel(v.teamSlot, v.teamSlot),
              v.mapName === "__TURN_SKIPPED__" ? "Turn skipped" : v.mapName,
              v.source.replaceAll("_", " "),
            ])}
            empty="No veto actions recorded."
          />
          {match.finalMap ? (
            <p className="text-muted-foreground mt-2 text-sm">
              Final map: <span className="font-medium">{match.finalMap}</span>
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="characters">
          <SimpleTable
            head={["Order", "Team", "Action", "Character", "Role", "Source"]}
            rows={match.characterBanActions.map((ban, i) => [
              String(i + 1),
              ban.teamSlot,
              ban.action,
              ban.character,
              ban.gameRole ?? "-",
              ban.source,
            ])}
            empty="No character bans recorded."
          />
        </TabsContent>

        <TabsContent value="maps">
          <SimpleTable
            head={["Map", "Name", match.teamAName, match.teamBName, "Status"]}
            rows={match.mapResults.map((m) => [
              String(m.mapIndex + 1),
              m.mapName,
              scoreSide(m.teamAScore, m.teamAResult),
              scoreSide(m.teamBScore, m.teamBResult),
              m.status,
            ])}
            empty="No maps started yet."
          />
        </TabsContent>

        <TabsContent value="scores">
          {canManage ? (
            <EditableScoreReports
              teamAName={match.teamAName}
              teamBName={match.teamBName}
              reports={match.scoreReports.map((s) => ({
                id: s.id,
                teamAScore: s.teamAScore,
                teamBScore: s.teamBScore,
                teamAResult: s.teamAResult,
                teamBResult: s.teamBResult,
                scoringType: s.scoringType,
                status: s.status,
                comment: s.comment,
                createdAt: s.createdAt,
              }))}
            />
          ) : (
            <SimpleTable
              head={["Score", "Type", "Status", "Comment", "When"]}
              rows={match.scoreReports.map((s) => [
                formatScore(s.teamAScore, s.teamBScore, s.teamAResult, s.teamBResult),
                s.scoringType,
                s.status,
                s.comment ?? "-",
                fmt(s.createdAt),
              ])}
              empty="No score reports."
            />
          )}
        </TabsContent>

        <TabsContent value="pauses">
          <SimpleTable
            head={["Type", "Team", "Minutes", "Reason", "When"]}
            rows={match.pauseLogs.map((p) => [
              p.pauseType,
              p.teamName ?? "-",
              String(p.durationMinutes),
              p.reason,
              fmt(p.createdAt),
            ])}
            empty="No pauses logged."
          />
        </TabsContent>

        <TabsContent value="warnings">
          <SimpleTable
            head={["Player", "Team", "Rule", "Note", "When"]}
            rows={match.warnings.map((w) => [
              w.player,
              w.teamName ?? "-",
              w.rule,
              w.note ?? "-",
              fmt(w.createdAt),
            ])}
            empty="No warnings issued."
          />
        </TabsContent>

        <TabsContent value="evidence">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {match.evidence.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No evidence submitted.
                      </TableCell>
                    </TableRow>
                  ) : (
                    match.evidence.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Badge variant="outline">{e.status}</Badge>
                        </TableCell>
                        <TableCell>{e.note ?? "-"}</TableCell>
                        <TableCell>
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            View
                          </a>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right text-sm">
                          {fmt(e.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rosters">
          <SimpleTable
            head={["Team", "Slot", "Players", "Status"]}
            rows={match.rosterSubmissions.map((r) => [
              r.teamName,
              r.teamSlot,
              String(Array.isArray(r.players) ? r.players.length : 0),
              r.status,
            ])}
            empty="No roster submissions."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RefereeAssignmentPanel({
  code,
  claimMode,
  effectiveClaimMode,
  claimLimit,
  effectiveClaimLimit,
  canClaim,
  canManage,
  assignedCount,
  assignments,
  availableReferees,
}: {
  code: string;
  claimMode: string;
  effectiveClaimMode: string;
  claimLimit: number;
  effectiveClaimLimit: number;
  canClaim: boolean;
  canManage: boolean;
  assignedCount: number;
  assignments: Array<{
    id: string;
    source: string;
    createdAt: Date;
    userProfile: { id: string; displayName: string | null; discordUserId: string };
    assignedBy: { displayName: string | null; discordUserId: string } | null;
  }>;
  availableReferees: Array<{
    userProfileId: string;
    role: OrgMemberRole;
    displayName: string;
  }>;
}) {
  const claimAction = claimWebRefereeAssignment.bind(null, code);
  const settingsAction = updateWebRefereeClaimSettings.bind(null, code);
  const assignAction = assignWebReferee.bind(null, code);
  const roomAvailable = assignedCount < effectiveClaimLimit;

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Referee assignment</h2>
            <p className="text-muted-foreground text-sm">
              Assign refs manually or let eligible org refs claim open slots.
              Players on either team are excluded automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={roomAvailable ? "secondary" : "outline"}>
              {assignedCount}/{effectiveClaimLimit} assigned
            </Badge>
            <Badge variant="outline">{effectiveClaimMode}</Badge>
          </div>
        </div>

        {assignments.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {assignment.userProfile.displayName ??
                      assignment.userProfile.discordUserId}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {assignment.source} · {fmt(assignment.createdAt)}
                    {assignment.assignedBy
                      ? ` · by ${
                          assignment.assignedBy.displayName ??
                          assignment.assignedBy.discordUserId
                        }`
                      : ""}
                  </p>
                </div>
                {canManage ? (
                  <form action={removeWebRefereeAssignment}>
                    <input
                      type="hidden"
                      name="assignmentId"
                      value={assignment.id}
                    />
                    <ConfirmSubmitButton
                      type="submit"
                      size="sm"
                      variant="ghost"
                      confirmMessage="Remove this referee assignment?"
                    >
                      Remove
                    </ConfirmSubmitButton>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            No referees assigned yet.
          </p>
        )}

        <div className="grid gap-3 lg:grid-cols-3">
          {canClaim ? (
            <form action={claimAction} className="rounded-lg border p-3">
              <p className="text-sm font-medium">Claim a slot</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Claims are checked inside a serializable database transaction,
                so simultaneous clicks cannot overfill the limit.
              </p>
              <PendingSubmitButton
                className="mt-3 w-full"
                pendingChildren="Claiming..."
                disabled={effectiveClaimMode !== "open" || !roomAvailable}
              >
                Claim Match
              </PendingSubmitButton>
            </form>
          ) : null}

          {canManage ? (
            <>
              <form action={settingsAction} className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Claim settings</p>
                <NativeSelect
                  name="refereeClaimMode"
                  defaultValue={claimMode}
                  className="h-9"
                >
                  <option value="open">Open for eligible refs</option>
                  <option value="assigned">Manual assignment only</option>
                  <option value="tournament">Use tournament default</option>
                </NativeSelect>
                <Input
                  name="refereeClaimLimit"
                  type="number"
                  min={1}
                  max={12}
                  defaultValue={claimLimit}
                  aria-label="Referee claim limit"
                />
                <PendingSubmitButton className="w-full" pendingChildren="Saving...">
                  Save Claim Settings
                </PendingSubmitButton>
              </form>

              <form action={assignAction} className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Assign referee</p>
                <NativeSelect name="userProfileId" className="h-9" required>
                  <option value="">Choose eligible operator/referee</option>
                  {availableReferees.map((referee) => (
                    <option
                      key={referee.userProfileId}
                      value={referee.userProfileId}
                    >
                      {referee.displayName} ({referee.role.toLowerCase()})
                    </option>
                  ))}
                </NativeSelect>
                <PendingSubmitButton className="w-full" pendingChildren="Assigning...">
                  Assign Referee
                </PendingSubmitButton>
              </form>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function EditableScoreReports({
  teamAName,
  teamBName,
  reports,
}: {
  teamAName: string;
  teamBName: string;
  reports: Array<{
    id: string;
    teamAScore: number;
    teamBScore: number;
    teamAResult: string | null;
    teamBResult: string | null;
    scoringType: string;
    status: string;
    comment: string | null;
    createdAt: Date;
  }>;
}) {
  if (!reports.length) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
        No score reports.
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {reports.map((report) => {
        const action = updateWebScoreReport.bind(null, report.id);
        return (
          <form key={report.id} action={action} className="space-y-3 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Score report</p>
                <p className="text-muted-foreground text-xs">
                  {fmt(report.createdAt)}
                </p>
              </div>
              <Badge variant="outline">{report.status}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs font-medium">{teamAName}</span>
                <Input
                  name="teamAScore"
                  type="number"
                  min={0}
                  defaultValue={report.teamAScore}
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium">{teamBName}</span>
                <Input
                  name="teamBScore"
                  type="number"
                  min={0}
                  defaultValue={report.teamBScore}
                  required
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs font-medium">{teamAName} ruling</span>
                <NativeSelect
                  name="teamAResult"
                  defaultValue={report.teamAResult ?? ""}
                  className="h-9"
                >
                  {RESULT_LABEL_OPTIONS.map((option) => (
                    <option key={option.value || "numeric"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium">{teamBName} ruling</span>
                <NativeSelect
                  name="teamBResult"
                  defaultValue={report.teamBResult ?? ""}
                  className="h-9"
                >
                  {RESULT_LABEL_OPTIONS.map((option) => (
                    <option key={option.value || "numeric"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            </div>
            <NativeSelect
              name="scoringType"
              defaultValue={report.scoringType}
              className="h-9"
            >
              <option value="match">Whole match</option>
              <option value="map">Map/game</option>
              <option value="round">Round based</option>
              <option value="penalty">Penalty adjustment</option>
            </NativeSelect>
            <Input
              name="comment"
              defaultValue={report.comment ?? ""}
              placeholder="Correction note"
              maxLength={500}
            />
            <PendingSubmitButton className="w-full" pendingChildren="Saving correction...">
              Save Correction
            </PendingSubmitButton>
          </form>
        );
      })}
    </div>
  );
}

function LiveVetoOverview({
  teamAName,
  teamBName,
  bestOf,
  status,
  vetoMode,
  vetoStartingTeam,
  vetoTimerSeconds,
  vetoTimeoutAction,
  finalMap,
  turnStartedAt,
  code,
  mapPool,
  viewerTeamSlots,
  vetoActions,
}: {
  teamAName: string;
  teamBName: string;
  bestOf: number;
  status: string;
  vetoMode: string;
  vetoStartingTeam: string;
  vetoTimerSeconds: number;
  vetoTimeoutAction: string;
  finalMap: string | null;
  turnStartedAt: string | null;
  code: string;
  mapPool: MapEntry[];
  viewerTeamSlots: string[];
  vetoActions: VetoActionView[];
}) {
  const maps = normalizeMapPool(mapPool);
  const nextVeto = nextVetoState({
    bestOf,
    vetoMode,
    vetoStartingTeam,
    mapPool,
    vetoActions,
  });
  const vetoStarted = status === "VETO" || vetoActions.length > 0;
  const vetoComplete = Boolean(finalMap) || nextVeto.complete;
  // Teams can only act once the referee has actually started (or resumed) the
  // veto — status is "VETO". Before that, or while paused, no team turn shows.
  const vetoLive = status === "VETO";
  const isViewerTurn =
    vetoLive && !vetoComplete && viewerTeamSlots.includes(nextVeto.teamSlot);
  const usedMaps = new Set(
    vetoActions
      .map((action) => action.mapName)
      .filter((mapName) => !mapName.startsWith("__")),
  );
  const remainingMaps = maps.filter((entry) => !usedMaps.has(entry.name));
  const teamVetoAction = submitTeamVetoAction.bind(null, code);

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Live veto</h2>
            <p className="text-muted-foreground text-sm">
              Visible to teams, players, and referees watching this match page.
              Turns refresh automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isViewerTurn ? <Badge>Your turn</Badge> : null}
            <Badge
              variant={
                vetoComplete || vetoStarted || status === "VETO"
                  ? "default"
                  : "outline"
              }
            >
              {vetoComplete ? "Complete" : vetoStarted ? "Live" : "Not started"}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Format</p>
            <p className="font-medium">{vetoMode.replaceAll("_", " ")}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Current turn</p>
            <p className="font-medium">
              {vetoComplete
                ? "No active turn"
                : `${teamDisplay(nextVeto.teamSlot, teamAName, teamBName)} ${nextVeto.kind.toLowerCase()}`}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Turn length</p>
            <p className="font-medium">{vetoTimerSeconds}s per turn</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">Missed turn</p>
            <p className="font-medium">
              {vetoTimeoutAction.replaceAll("_", " ")}
            </p>
          </div>
        </div>

        <VetoCountdown
          durationSeconds={vetoTimerSeconds}
          startedAt={vetoStarted ? turnStartedAt : null}
          complete={vetoComplete}
        />

        {isViewerTurn ? (
          <form action={teamVetoAction} className="rounded-lg border p-3">
            <div className="mb-3">
              <p className="text-sm font-medium">Submit your team turn</p>
              <p className="text-muted-foreground text-xs">
                Captains, coaches, managers, and team leaders can submit for the
                active team.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_auto]">
              <NativeSelect name="mapName" required className="h-9">
                <option value="">Select map</option>
                {remainingMaps.map((map) => (
                  <option key={map.name} value={map.name}>
                    {map.mode ? `${map.mode} - ${map.name}` : map.name}
                  </option>
                ))}
              </NativeSelect>
              <Input name="note" placeholder="Optional note" maxLength={240} />
              <PendingSubmitButton pendingChildren="Submitting...">
                Submit {nextVeto.kind === "BAN" ? "Ban" : "Pick"}
              </PendingSubmitButton>
            </div>
          </form>
        ) : null}

        {!vetoLive && !vetoComplete && viewerTeamSlots.length > 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            Waiting for the referee to {vetoStarted ? "resume" : "start"} the veto
            before your team can submit.
          </p>
        ) : null}

        {finalMap ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-muted-foreground text-xs">Final map</p>
            <p className="font-medium">{finalMap}</p>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)]">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Veto timeline
            </p>
            {vetoActions.length ? (
              <ol className="space-y-2">
                {vetoActions.map((action, index) => (
                  <li
                    key={action.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="text-muted-foreground mr-2 tabular-nums">
                        {index + 1}.
                      </span>
                      {vetoActionSummary(action, teamAName, teamBName)}
                    </span>
                    <div className="flex items-center gap-2">
                      {action.note ? (
                        <span className="text-muted-foreground max-w-64 truncate text-xs">
                          {action.note}
                        </span>
                      ) : null}
                      <Badge variant="outline">
                        {(action.source ?? action.kind).replaceAll("_", " ")}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
                No veto actions yet.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Remaining maps
            </p>
            {remainingMaps.length ? (
              <div className="flex flex-wrap gap-2">
                {remainingMaps.slice(0, 12).map((map) => (
                  <Badge key={map.name} variant="outline">
                    {map.mode ? `${map.mode}: ${map.name}` : map.name}
                  </Badge>
                ))}
                {remainingMaps.length > 12 ? (
                  <Badge variant="outline">+{remainingMaps.length - 12}</Badge>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
                No remaining maps.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveCharacterBans({
  code,
  teamAName,
  teamBName,
  status,
  characterBanMode,
  characterBanStarted,
  vetoStartingTeam,
  characterPool,
  viewerTeamSlots,
  characterBanActions,
}: {
  code: string;
  teamAName: string;
  teamBName: string;
  status: string;
  characterBanMode: string;
  characterBanStarted: boolean;
  vetoStartingTeam: string;
  characterPool: MapEntry[];
  viewerTeamSlots: string[];
  characterBanActions: Array<{
    id: string;
    teamSlot: string;
    action: string;
    character: string;
    gameRole: string | null;
    source: string;
  }>;
}) {
  const startingTeam = vetoStartingTeam === "teamB" ? "teamB" : "teamA";
  const nextTeam =
    characterBanActions.length % 2 === 0
      ? startingTeam
      : otherTeamSlot(startingTeam);
  const pool = normalizeMapPool(characterPool);
  const usedCharacters = new Set(
    characterBanActions.map((action) => action.character.toLowerCase()),
  );
  const remainingPool = pool.filter(
    (entry) => !usedCharacters.has(entry.name.toLowerCase()),
  );
  const phaseClosed = status === "COMPLETE" || status === "CANCELLED";
  const poolExhausted = pool.length > 0 && remainingPool.length === 0;
  const isViewerTurn =
    characterBanStarted &&
    !phaseClosed &&
    !poolExhausted &&
    viewerTeamSlots.includes(nextTeam);
  const teamBanAction = submitTeamCharacterBanAction.bind(null, code);

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Character bans</h2>
            <p className="text-muted-foreground text-sm">
              Teams submit their own bans/protects when it is their turn.
              Referees can also enter bans from the controls below.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isViewerTurn ? <Badge>Your turn</Badge> : null}
            <Badge variant={characterBanStarted ? "default" : "outline"}>
              {characterBanStarted ? "Live" : "Not started"}
            </Badge>
            <Badge variant="outline">{characterBanMode.replaceAll("_", " ")}</Badge>
          </div>
        </div>

        <div className="rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground text-xs">Current turn</p>
          <p className="font-medium">
            {!characterBanStarted
              ? "Waiting for referee to start"
              : phaseClosed || poolExhausted
                ? "No active turn"
                : `${teamDisplay(nextTeam, teamAName, teamBName)} to choose`}
          </p>
        </div>

        {!characterBanStarted && viewerTeamSlots.length > 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            Waiting for the referee to start character bans before your team can
            submit.
          </p>
        ) : null}

        {isViewerTurn ? (
          <form action={teamBanAction} className="rounded-lg border p-3">
            <div className="mb-3">
              <p className="text-sm font-medium">Submit your team ban</p>
              <p className="text-muted-foreground text-xs">
                Captains, coaches, managers, and team leaders can submit for the
                active team.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <NativeSelect name="action" defaultValue="ban" className="h-9">
                <option value="ban">Ban</option>
                <option value="protect">Protect</option>
                <option value="vote">OWCS ranked vote winner</option>
                <option value="fearless_lock">LoL Fearless lock</option>
              </NativeSelect>
              {pool.length ? (
                <NativeSelect name="character" required className="h-9">
                  <option value="">Select character</option>
                  {remainingPool.map((entry) => (
                    <option key={entry.name} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input
                  name="character"
                  placeholder="Champion, agent, hero, or character"
                  maxLength={120}
                  required
                />
              )}
              <Input
                name="gameRole"
                placeholder="Optional role: Tank, Duelist, ADC..."
                maxLength={80}
              />
              <Input name="note" placeholder="Optional note" maxLength={240} />
            </div>
            <div className="mt-2">
              <PendingSubmitButton pendingChildren="Submitting...">
                Submit Character Ban
              </PendingSubmitButton>
            </div>
          </form>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ban timeline
          </p>
          {characterBanActions.length ? (
            <ol className="space-y-2">
              {characterBanActions.map((action, index) => (
                <li
                  key={action.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <span>
                    <span className="text-muted-foreground mr-2 tabular-nums">
                      {index + 1}.
                    </span>
                    <span className="font-medium">
                      {teamDisplay(action.teamSlot, teamAName, teamBName)}
                    </span>{" "}
                    {action.action.replaceAll("_", " ")} {action.character}
                    {action.gameRole ? ` (${action.gameRole})` : ""}
                  </span>
                  <Badge variant="outline">{action.source.replaceAll("_", " ")}</Badge>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
              No character bans yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {head.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={head.length}
                  className="text-muted-foreground py-8 text-center"
                >
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
