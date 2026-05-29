import Link from "next/link";

import { NoOrgAccess, PageHeader, StatusBadge } from "@/components/dashboard-ui";
import { OpenMatchByCode } from "@/components/open-match-by-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAccessContext } from "@/lib/auth-session";
import { formatDate } from "@/lib/format-date";
import { prisma } from "@/lib/prisma";
import { formatScore } from "@/lib/score-format";

import { CreateMatchForm } from "./create-match-form";

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

  const [matches, teams, rulesPresets] = await Promise.all([
    prisma.match.findMany({
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
        teamAResult: true,
        teamBResult: true,
        channelId: true,
        createdAt: true,
        organization: { select: { discordGuildId: true, name: true } },
      },
    }),
    prisma.team.findMany({
      where: { organizationId: { in: ctx.orgIds } },
      orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        organization: { select: { id: true, name: true } },
      },
    }),
    prisma.rulesPreset.findMany({
      where: { organizationId: { in: ctx.orgIds } },
      orderBy: [{ organization: { name: "asc" } }, { label: "asc" }],
      select: {
        id: true,
        key: true,
        label: true,
        gameTitle: true,
        organization: { select: { id: true, name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matches"
        description={`${matches.length} most recent across your organizations.`}
        actions={<OpenMatchByCode />}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create match</CardTitle>
          <CardDescription>
            Select existing teams to link rosters and player check-ins. Use
            custom names only for one-off matches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateMatchForm
            orgs={ctx.staffOrgs.map((org) => ({ id: org.id, name: org.name }))}
            teams={teams}
            rulesPresets={rulesPresets}
            defaultOrganizationId={ctx.activeStaffOrg?.id ?? ctx.staffOrgs[0]?.id}
          />
        </CardContent>
      </Card>
      <div className="grid gap-3 md:hidden">
        {matches.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              No matches yet.
            </CardContent>
          </Card>
        ) : (
          matches.map((m) => (
            <Card key={m.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/matches/${m.publicCode}`}
                      className="text-primary font-mono text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {m.publicCode}
                    </Link>
                    <h2 className="truncate text-base font-semibold">
                      {m.teamAName} vs {m.teamBName}
                    </h2>
                    <p className="text-muted-foreground truncate text-xs">
                      {m.organization.name} / Bo{m.bestOf}
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="tabular-nums">
                    {formatScore(
                      m.teamAScore,
                      m.teamBScore,
                      m.teamAResult,
                      m.teamBResult,
                    )}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(m.createdAt)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/matches/${m.publicCode}`}>Details</Link>
                  </Button>
                  {m.channelId ? (
                    <Button asChild>
                      <a
                        href={`https://discord.com/channels/${m.organization.discordGuildId}/${m.channelId}`}
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
                        className="text-primary font-mono underline-offset-2 hover:underline"
                      >
                        {m.publicCode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {m.teamAName} vs {m.teamBName}
                    </TableCell>
                    <TableCell>Bo{m.bestOf}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatScore(
                        m.teamAScore,
                        m.teamBScore,
                        m.teamAResult,
                        m.teamBResult,
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-muted-foreground">
                          {formatDate(m.createdAt)}
                        </span>
                        <Button asChild size="sm">
                          <Link href={`/matches/${m.publicCode}`}>Open</Link>
                        </Button>
                      </div>
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
