import Link from "next/link";

import { NoOrgAccess, PageHeader, StatusBadge } from "@/components/dashboard-ui";
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
      createdAt: true,
      _count: { select: { teams: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="BR Lobbies"
        description={`${lobbies.length} most recent across your organizations.`}
      />
      <Card>
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
