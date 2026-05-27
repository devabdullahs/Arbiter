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

import { BrActionsPanel } from "./br-actions-panel";

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
  const teamName = new Map(lobby.teams.map((team) => [team.id, team.name]));
  const gamesPlayed = lobby.results.reduce(
    (max, result) => Math.max(max, result.gameNumber),
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
          description={`${lobby.game} - ${lobby.teams.length} teams - game ${gamesPlayed}/${lobby.gamesPlanned}`}
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{lobby.publicCode}</span>
          <StatusBadge status={lobby.status} />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div>
            <h2 className="text-sm font-medium">BR operations</h2>
            <p className="text-muted-foreground text-sm">
              Log games, penalties, pauses, warnings, evidence, disputes, and
              final status from the web. If this lobby has a Discord panel,
              Arbiter queues a Discord refresh after each change.
            </p>
          </div>
          <BrActionsPanel
            code={lobby.publicCode}
            teams={lobby.teams.map((team) => ({
              id: team.id,
              name: team.name,
              seed: team.seed,
            }))}
            nextGameNumber={Math.min(gamesPlayed + 1, lobby.gamesPlanned)}
          />
        </CardContent>
      </Card>

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
              {standings.map((standing, index) => (
                <TableRow key={standing.id}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {standing.name}
                    {standing.adjust !== 0 ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({standing.adjust > 0 ? "+" : ""}
                        {standing.adjust} adj)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {standing.points}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {standing.kills}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {standing.games}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {standing.bestPlacement ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Tabs defaultValue="results">
        <TabsList className="flex-wrap">
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
            rows={orderedResults.map((result) => [
              `Game ${result.gameNumber}`,
              teamName.get(result.brTeamId) ?? "-",
              `#${result.placement}`,
              result.kills,
              result.points,
            ])}
            empty="No game results logged."
          />
        </TabsContent>

        <TabsContent value="adjustments">
          <SimpleTable
            head={["Team", "Points", "Kills", "Game", "Reason"]}
            rows={lobby.adjustments.map((adjustment) => [
              teamName.get(adjustment.brTeamId) ?? "-",
              adjustment.points > 0 ? `+${adjustment.points}` : adjustment.points,
              adjustment.kills > 0 ? `+${adjustment.kills}` : adjustment.kills,
              adjustment.gameNumber ? `Game ${adjustment.gameNumber}` : "-",
              adjustment.reason,
            ])}
            empty="No adjustments or penalties."
          />
        </TabsContent>

        <TabsContent value="logs">
          <SimpleTable
            head={["Kind", "Team", "Summary", "When"]}
            rows={lobby.logs.map((log) => [
              log.kind,
              log.brTeamId ? (teamName.get(log.brTeamId) ?? "-") : "-",
              log.summary ?? log.details ?? log.attachmentUrl ?? "-",
              fmt(log.createdAt),
            ])}
            empty="No referee logs."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
