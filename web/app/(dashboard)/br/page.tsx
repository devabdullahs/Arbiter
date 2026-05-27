import Link from "next/link";

import { NoOrgAccess, PageHeader, StatusBadge } from "@/components/dashboard-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export default async function BrLobbiesPage() {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  if (ctx.orgIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="BR Lobbies" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const lobbies = await prisma.brLobby.findMany({
    where: { organizationId: { in: ctx.orgIds } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      publicCode: true,
      name: true,
      game: true,
      status: true,
      gamesPlanned: true,
      channelId: true,
      createdAt: true,
      organization: { select: { discordGuildId: true, name: true } },
      _count: { select: { teams: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="BR Lobbies"
        description={`${lobbies.length} most recent across your organizations.`}
      />
      <div className="grid gap-3 md:hidden">
        {lobbies.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              No BR lobbies yet.
            </CardContent>
          </Card>
        ) : (
          lobbies.map((l) => (
            <Card key={l.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/br/${l.publicCode}`}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      {l.publicCode}
                    </Link>
                    <h2 className="truncate text-base font-semibold">
                      {l.name}
                    </h2>
                    <p className="text-muted-foreground truncate text-xs">
                      {l.organization.name} / {l.game}
                    </p>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{l._count.teams} teams</Badge>
                  <Badge variant="outline">{l.gamesPlanned} games</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/br/${l.publicCode}`}>Standings</Link>
                  </Button>
                  {l.channelId ? (
                    <Button asChild>
                      <a
                        href={`https://discord.com/channels/${l.organization.discordGuildId}/${l.channelId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Discord
                      </a>
                    </Button>
                  ) : (
                    <Button disabled>Discord</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Game</TableHead>
                <TableHead>Teams</TableHead>
                <TableHead>Games</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lobbies.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground py-8 text-center"
                  >
                    No BR lobbies yet.
                  </TableCell>
                </TableRow>
              ) : (
                lobbies.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link
                        href={`/br/${l.publicCode}`}
                        className="font-mono hover:underline"
                      >
                        {l.publicCode}
                      </Link>
                    </TableCell>
                    <TableCell>{l.name}</TableCell>
                    <TableCell>{l.game}</TableCell>
                    <TableCell className="tabular-nums">
                      {l._count.teams}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {l.gamesPlanned}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={l.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
