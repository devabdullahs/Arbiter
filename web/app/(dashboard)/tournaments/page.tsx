import Link from "next/link";

import { NoOrgAccess, PageHeader } from "@/components/dashboard-ui";
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

import { CreateTournamentForm } from "./create-tournament-form";

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: "Single elim",
  double_elimination: "Double elim",
  round_robin: "Round robin",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  active: "default",
  complete: "secondary",
};

export default async function TournamentsPage() {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  if (ctx.orgIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tournaments" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const tournaments = await prisma.tournament.findMany({
    where: { organizationId: { in: ctx.orgIds } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      publicCode: true,
      name: true,
      gameTitle: true,
      format: true,
      status: true,
      championName: true,
      createdAt: true,
      organization: { select: { name: true } },
      _count: { select: { entries: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tournaments"
        description={`${tournaments.length} most recent across your organizations.`}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create tournament</CardTitle>
          <CardDescription>
            Seed teams and generate a single-elimination, double-elimination, or
            round-robin bracket. Winners advance automatically as you report
            results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTournamentForm
            orgs={ctx.staffOrgs.map((org) => ({ id: org.id, name: org.name }))}
            defaultOrganizationId={ctx.activeStaffOrg?.id ?? ctx.staffOrgs[0]?.id}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Tournament</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Teams</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tournaments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    No tournaments yet.
                  </TableCell>
                </TableRow>
              ) : (
                tournaments.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/tournaments/${t.publicCode}`} className="font-mono hover:underline">
                        {t.publicCode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {t.organization.name}
                        {t.gameTitle ? ` / ${t.gameTitle}` : ""}
                        {t.championName ? ` / 🏆 ${t.championName}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>{FORMAT_LABELS[t.format] ?? t.format}</TableCell>
                    <TableCell className="tabular-nums">{t._count.entries}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[t.status] ?? "outline"}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <span className="whitespace-nowrap">{formatDate(t.createdAt)}</span>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/tournaments/${t.publicCode}`}>Open</Link>
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
