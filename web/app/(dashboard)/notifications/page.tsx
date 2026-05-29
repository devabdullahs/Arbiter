import Link from "next/link";
import { Bell, CheckCircle2, ClipboardCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { EmptyState, PageHeader } from "@/components/dashboard-ui";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAccessibleOrgs, getSession } from "@/lib/auth-session";
import { getActiveOrgId } from "@/lib/org-selection";
import { getTodoItems } from "@/lib/todos";

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardContent>
    </Card>
  );
}

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [{ orgs }, activeOrgId] = await Promise.all([
    getAccessibleOrgs(session.user.id),
    getActiveOrgId(),
  ]);
  const activeOrg =
    orgs.find((org) => org.id === activeOrgId) ?? orgs[0] ?? null;
  const { summary, items } = await getTodoItems(
    session.user.id,
    orgs,
    activeOrg?.id ?? null,
    "player",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description={
          activeOrg
            ? `Player alerts for ${activeOrg.name}.`
            : "Player alerts for your active organization."
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="Total"
          value={summary.playerTotal}
          description="Player-facing items scoped to your teams and role."
        />
        <StatCard
          label="Check-ins"
          value={summary.player.checkinsNeeded}
          description="Matches where your player check-in is still missing."
        />
        <StatCard
          label="Live"
          value={summary.player.liveMatches}
          description="Veto or live matches connected to your teams."
        />
        <StatCard
          label="Announcements"
          value={summary.player.announcements}
          description="Org messages targeted to your player or team role."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{summary.player.activeTurns} active turns</Badge>
        <Badge variant="outline">{summary.player.checkinsNeeded} check-ins</Badge>
        <Badge variant="outline">{summary.player.liveMatches} live matches</Badge>
        <Badge variant="outline">{summary.player.announcements} announcements</Badge>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No player alerts"
          description="Check-ins, live veto turns, match starts, and targeted announcements appear here only when they apply to your team or role."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4" />
              Player alert feed
            </CardTitle>
            <CardDescription>
              Securely scoped alerts. You will not see private referee-only
              tasks or other teams&apos; player alerts.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="hover:bg-muted/50 flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
                    <ClipboardCheck className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {item.description}
                    </span>
                  </span>
                </span>
                <Badge variant="secondary">player</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
