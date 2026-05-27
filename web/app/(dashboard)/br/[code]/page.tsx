import { notFound } from "next/navigation";

import {
  NoOrgAccess,
  PageHeader,
  SimpleTable,
  StatusBadge,
} from "@/components/dashboard-ui";
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
import { computeBrStandings } from "@/lib/br";
import { prisma } from "@/lib/prisma";

function fmt(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export default async function BrLobbyDetailPage({
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
        <PageHeader title="BR Lobby" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const lobby = await prisma.brLobby.findFirst({
    where: {
      publicCode: code.toUpperCase(),
      organizationId: { in: ctx.orgIds },
    },
    include: {
      teams: { orderBy: { seed: "asc" } },
      results: true,
      adjustments: { orderBy: { createdAt: "desc" } },
      logs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!lobby) notFound();

  const standings = computeBrStandings(lobby);
  const teamName = new Map(lobby.teams.map((t) => [t.id, t.name]));
  const gamesPlayed = lobby.results.reduce(
    (max, r) => Math.max(max, r.gameNumber),
    0,
  );
  const orderedResults = [...lobby.results].sort(
    (a, b) => a.gameNumber - b.gameNumber || b.points - a.points,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title={lobby.name}
          description={`${lobby.game} · ${lobby.teams.length} teams · game ${gamesPlayed}/${lobby.gamesPlanned}`}
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{lobby.publicCode}</span>
          <StatusBadge status={lobby.status} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Kills</TableHead>
                <TableHead className="text-right">Games</TableHead>
                <TableHead className="text-right">Best</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {s.name}
                    {s.adjust !== 0 ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({s.adjust > 0 ? "+" : ""}
                        {s.adjust} adj)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {s.points}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.kills}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.games}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.bestPlacement ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="results">
            Results ({lobby.results.length})
          </TabsTrigger>
          <TabsTrigger value="adjustments">
            Adjustments ({lobby.adjustments.length})
          </TabsTrigger>
          <TabsTrigger value="logs">Logs ({lobby.logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="results">
          <SimpleTable
            head={["Game", "Team", "Placement", "Kills", "Points"]}
            rows={orderedResults.map((r) => [
              `Game ${r.gameNumber}`,
              teamName.get(r.brTeamId) ?? "—",
              `#${r.placement}`,
              r.kills,
              r.points,
            ])}
            empty="No game results logged."
          />
        </TabsContent>

        <TabsContent value="adjustments">
          <SimpleTable
            head={["Team", "Points", "Kills", "Game", "Reason"]}
            rows={lobby.adjustments.map((a) => [
              teamName.get(a.brTeamId) ?? "—",
              a.points > 0 ? `+${a.points}` : a.points,
              a.kills > 0 ? `+${a.kills}` : a.kills,
              a.gameNumber ? `Game ${a.gameNumber}` : "—",
              a.reason,
            ])}
            empty="No adjustments or penalties."
          />
        </TabsContent>

        <TabsContent value="logs">
          <SimpleTable
            head={["Kind", "Team", "Summary", "When"]}
            rows={lobby.logs.map((l) => [
              l.kind,
              l.brTeamId ? (teamName.get(l.brTeamId) ?? "—") : "—",
              l.summary ?? l.details ?? "—",
              fmt(l.createdAt),
            ])}
            empty="No referee logs."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
