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

import { createWebMatch } from "./actions";

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
      channelId: true,
      createdAt: true,
      organization: { select: { discordGuildId: true, name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matches"
        description={`${matches.length} most recent across your organizations.`}
      />
      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="text-sm font-medium">Create match</h2>
          <form action={createWebMatch} className="grid gap-3 lg:grid-cols-6">
            <select
              name="organizationId"
              defaultValue={ctx.activeOrg?.id ?? ctx.orgs[0]?.id}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            >
              {ctx.orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <input
              name="teamAName"
              placeholder="Team A"
              required
              maxLength={80}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            />
            <input
              name="teamBName"
              placeholder="Team B"
              required
              maxLength={80}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            />
            <input
              name="bestOf"
              type="number"
              min={1}
              max={99}
              defaultValue={3}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            />
            <select
              name="rulesPreset"
              defaultValue="generic"
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            >
              <option value="generic">Generic</option>
              <option value="valorant">Valorant</option>
              <option value="overwatch">Overwatch</option>
              <option value="r6s">Rainbow Six Siege</option>
              <option value="cod">Call of Duty</option>
              <option value="rocket_league">Rocket League</option>
            </select>
            <Button type="submit">Create</Button>
            <textarea
              name="mapPool"
              placeholder="Optional custom map pool, comma-separated or one per line"
              maxLength={2000}
              className="border-input bg-background min-h-20 rounded-lg border px-2.5 py-2 text-sm lg:col-span-4"
            />
            <select
              name="vetoMode"
              defaultValue="series_picks"
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            >
              <option value="series_picks">Series picks</option>
              <option value="final_map_ban">Final map ban</option>
              <option value="manual_picks">Manual picks</option>
            </select>
            <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
              <input type="checkbox" name="allowPlayerReports" />
              Player reports
            </label>
          </form>
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
                      className="font-mono text-sm font-medium hover:underline"
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
                    {m.teamAScore}-{m.teamBScore}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {m.createdAt.toISOString().slice(0, 10)}
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
