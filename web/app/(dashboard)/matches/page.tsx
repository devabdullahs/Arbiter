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

export default async function MatchesPage() {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  if (ctx.orgIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Matches" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const matches = await prisma.match.findMany({
    where: { organizationId: { in: ctx.orgIds } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      publicCode: true,
      teamAName: true,
      teamBName: true,
      bestOf: true,
      status: true,
      teamAScore: true,
      teamBScore: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matches"
        description={`${matches.length} most recent across your organizations.`}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground py-8 text-center"
                  >
                    No matches yet.
                  </TableCell>
                </TableRow>
              ) : (
                matches.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link
                        href={`/matches/${m.publicCode}`}
                        className="font-mono hover:underline"
                      >
                        {m.publicCode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {m.teamAName} vs {m.teamBName}
                    </TableCell>
                    <TableCell>Bo{m.bestOf}</TableCell>
                    <TableCell className="tabular-nums">
                      {m.teamAScore}&ndash;{m.teamBScore}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-sm">
                      {m.createdAt.toISOString().slice(0, 10)}
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
