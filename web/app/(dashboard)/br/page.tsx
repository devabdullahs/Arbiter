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

import { createWebBrLobby } from "./actions";

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

  const [lobbies, teams] = await Promise.all([
    prisma.brLobby.findMany({
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
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="BR Lobbies"
        description={`${lobbies.length} most recent across your organizations.`}
      />
      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="text-sm font-medium">Create BR lobby</h2>
          <p className="text-muted-foreground text-sm">
            Select registered teams to link the lobby to rosters, then add any
            extra invite teams below.
          </p>
          <form action={createWebBrLobby} className="grid gap-3 lg:grid-cols-6">
            <select
              name="organizationId"
              defaultValue={ctx.activeStaffOrg?.id ?? ctx.staffOrgs[0]?.id}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            >
              {ctx.staffOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <input
              name="name"
              placeholder="Lobby name"
              required
              maxLength={80}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm lg:col-span-2"
            />
            <select
              name="game"
              defaultValue="Apex Legends"
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            >
              <option>Apex Legends</option>
              <option>Fortnite</option>
              <option>PUBG Mobile</option>
              <option>PUBG: Battlegrounds</option>
              <option>Other</option>
            </select>
            <input
              name="gamesPlanned"
              type="number"
              min={1}
              max={50}
              defaultValue={6}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            />
            <input
              name="killPoints"
              type="number"
              min={0}
              max={20}
              defaultValue={1}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            />
            <textarea
              name="teams"
              placeholder="Extra teams, one per line"
              maxLength={3000}
              className="border-input bg-background min-h-28 rounded-lg border px-2.5 py-2 text-sm lg:col-span-4"
            />
            <label className="space-y-1 lg:col-span-2">
              <span className="text-xs font-medium">Registered teams</span>
              <select
                name="teamIds"
                multiple
                size={Math.min(12, Math.max(5, teams.length))}
                className="border-input bg-background min-h-28 w-full rounded-lg border px-2.5 py-2 text-sm"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.organization.name} / {team.name}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              name="placementPoints"
              placeholder="Optional placement points: 12,9,7,5..."
              maxLength={1000}
              className="border-input bg-background min-h-28 rounded-lg border px-2.5 py-2 text-sm lg:col-span-4"
            />
            <Button type="submit" className="lg:col-start-6">
              Create
            </Button>
          </form>
        </CardContent>
      </Card>
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
