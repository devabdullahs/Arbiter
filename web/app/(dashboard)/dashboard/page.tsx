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
import { cn } from "@/lib/utils";

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
    { label: "Live matches", value: liveMatches, href: "/matches", icon: Swords, highlight: false },
    { label: "Live BR lobbies", value: liveLobbies, href: "/br", icon: Trophy, highlight: false },
    {
      label: "Disputes",
      value: disputedMatches,
      href: "/matches",
      icon: ClipboardList,
      highlight: disputedMatches > 0,
    },
    { label: "Evidence items", value: evidenceCount, href: "/evidence", icon: Image, highlight: false },
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
            <Card
              className={cn(
                "h-full transition-colors hover:bg-muted/50",
                stat.highlight && "border-destructive/40",
              )}
            >
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                  <p
                    className={cn(
                      "text-2xl font-semibold tabular-nums",
                      stat.highlight && "text-destructive",
                    )}
                  >
                    {stat.value}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    stat.highlight
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <stat.icon className="size-5" />
                </span>
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
            <Link key={org.id} href="/org">
              <Card className="h-full transition-colors hover:bg-muted/50">
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
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
