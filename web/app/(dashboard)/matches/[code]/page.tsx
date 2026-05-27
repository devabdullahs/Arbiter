import { notFound } from "next/navigation";

import { NoOrgAccess, PageHeader, StatusBadge } from "@/components/dashboard-ui";
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
import { prisma } from "@/lib/prisma";

import { MatchActionsPanel } from "./match-actions-panel";

function fmt(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
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
      scoreReports: { orderBy: { createdAt: "desc" } },
      pauseLogs: { orderBy: { createdAt: "desc" } },
      warnings: { orderBy: { createdAt: "desc" } },
      evidence: { orderBy: { createdAt: "desc" } },
      rosterSubmissions: { orderBy: { teamSlot: "asc" } },
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
      organization: { select: { discordGuildId: true, name: true } },
    },
  });

  if (!match) notFound();
  const canManage = ctx.orgIds.includes(match.organizationId);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={`${match.teamAName} vs ${match.teamBName}`}
          description={`Bo${match.bestOf} / ${match.rulesPreset} / created ${fmt(match.createdAt)}`}
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl tabular-nums">
            {match.teamAScore}-{match.teamBScore}
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
        <TabsList className="flex-wrap">
          <TabsTrigger value="prematch">
            Check-ins ({match.checkins.length})
          </TabsTrigger>
          <TabsTrigger value="veto">Veto ({match.vetoActions.length})</TabsTrigger>
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
            head={["Order", "Action", "Team", "Map"]}
            rows={match.vetoActions.map((v, i) => [
              String(i + 1),
              v.kind,
              v.teamSlot,
              v.mapName,
            ])}
            empty="No veto actions recorded."
          />
          {match.finalMap ? (
            <p className="text-muted-foreground mt-2 text-sm">
              Final map: <span className="font-medium">{match.finalMap}</span>
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="scores">
          <SimpleTable
            head={["Score", "Type", "Status", "Comment", "When"]}
            rows={match.scoreReports.map((s) => [
              `${s.teamAScore}-${s.teamBScore}`,
              s.scoringType,
              s.status,
              s.comment ?? "-",
              fmt(s.createdAt),
            ])}
            empty="No score reports."
          />
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
