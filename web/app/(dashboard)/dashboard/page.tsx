import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Image, Swords, Trophy } from "lucide-react";

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
import { getAccessContext } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export default async function DashboardHome() {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  if (ctx.orgIds.length === 0) {
    if (ctx.activeOrg?.role === "PLAYER") {
      redirect("/player");
    }

    return (
      <div className="space-y-6">
        <PageHeader
          title="Overview"
          description="Your live operations hub for match and referee work."
        />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const [liveMatches, disputedMatches, liveLobbies, evidenceCount] =
    await Promise.all([
      prisma.match.count({
        where: { organizationId: { in: ctx.orgIds }, status: "LIVE" },
      }),
      prisma.match.count({
        where: { organizationId: { in: ctx.orgIds }, status: "DISPUTED" },
      }),
      prisma.brLobby.count({
        where: { organizationId: { in: ctx.orgIds }, status: "LIVE" },
      }),
      prisma.evidence.count({ where: { organizationId: { in: ctx.orgIds } } }),
    ]);

  const stats = [
    { label: "Live matches", value: liveMatches, href: "/matches", icon: Swords },
    { label: "Live BR lobbies", value: liveLobbies, href: "/br", icon: Trophy },
    {
      label: "Disputes",
      value: disputedMatches,
      href: "/matches",
      icon: ClipboardList,
    },
    { label: "Evidence items", value: evidenceCount, href: "/evidence", icon: Image },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Fast links and live counts for the selected organization."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {stat.value}
                  </p>
                </div>
                <stat.icon className="text-muted-foreground size-5" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick actions</CardTitle>
          <CardDescription>
            Big tap targets for the things referees open most often on a phone.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button asChild variant="outline" className="h-11 justify-start">
            <Link href="/matches">Open matches</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-start">
            <Link href="/br">Open BR lobbies</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-start">
            <Link href="/evidence">Evidence review</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-start">
            <Link href="/settings">My referee profile</Link>
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Organizations</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ctx.orgs.map((org) => (
            <Card key={org.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="truncate text-base">{org.name}</CardTitle>
                  <Badge variant="secondary">{org.role.toLowerCase()}</Badge>
                </div>
                <CardDescription className="truncate">
                  Guild {org.discordGuildId}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
