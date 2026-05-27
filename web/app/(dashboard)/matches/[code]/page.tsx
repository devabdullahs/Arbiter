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

  if (ctx.orgIds.length === 0) {
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
      organizationId: { in: ctx.orgIds },
    },
    include: {
      vetoActions: { orderBy: { createdAt: "asc" } },
      scoreReports: { orderBy: { createdAt: "desc" } },
      pauseLogs: { orderBy: { createdAt: "desc" } },
      warnings: { orderBy: { createdAt: "desc" } },
      evidence: { orderBy: { createdAt: "desc" } },
      rosterSubmissions: { orderBy: { teamSlot: "asc" } },
      organization: { select: { discordGuildId: true, name: true } },
    },
  });

  if (!match) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={`${match.teamAName} vs ${match.teamBName}`}
          description={`Bo${match.bestOf} · ${match.rulesPreset} · created ${fmt(match.createdAt)}`}
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl tabular-nums">
            {match.teamAScore}&ndash;{match.teamBScore}
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

      <Tabs defaultValue="veto">
        <TabsList className="flex-wrap">
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
              `${s.teamAScore}–${s.teamBScore}`,
              s.scoringType,
              s.status,
              s.comment ?? "—",
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
              p.teamName ?? "—",
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
              w.teamName ?? "—",
              w.rule,
              w.note ?? "—",
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
                        <TableCell>{e.note ?? "—"}</TableCell>
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
