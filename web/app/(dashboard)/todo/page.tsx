import Link from "next/link";
import { Bell, CheckCircle2, ClipboardCheck, ShieldCheck } from "lucide-react";
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
import { getAccessibleOrgs, getSession, isStaffRole } from "@/lib/auth-session";
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

export default async function TodoPage() {
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
    "staff",
  );
  const hasStaffView = activeOrg ? isStaffRole(activeOrg.role) : false;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="To-do"
        description={
          activeOrg
            ? `Action queue for ${activeOrg.name}.`
            : "Action queue for your active organization."
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          label="Staff queue"
          value={summary.staffTotal}
          description="Open referee and organizer tasks."
        />
        <StatCard
          label="Staff"
          value={
            summary.staff.disputedMatches +
            summary.staff.pendingScoreReports +
            summary.staff.pendingRosterSubmissions +
            summary.staff.pendingEvidence +
            summary.staff.dueReminders
          }
          description="Disputes, submitted evidence, rosters, and reports."
        />
        <StatCard
          label="Referee slots"
          value={summary.staff.claimableMatches}
          description="Matches open for referee claim."
        />
      </div>

      {hasStaffView ? (
        <div className="grid gap-3 md:grid-cols-6">
          <Badge variant="outline">
            {summary.staff.disputedMatches} disputes
          </Badge>
          <Badge variant="outline">
            {summary.staff.pendingScoreReports} score reports
          </Badge>
          <Badge variant="outline">
            {summary.staff.pendingRosterSubmissions} rosters
          </Badge>
          <Badge variant="outline">
            {summary.staff.pendingEvidence} evidence
          </Badge>
          <Badge variant="outline">
            {summary.staff.dueReminders} reminders
          </Badge>
          <Badge variant="outline">
            {summary.staff.claimableMatches} ref slots
          </Badge>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nothing needs attention"
          description="When score reports, evidence, disputes, roster submissions, reminders, or referee slots need action, they will appear here."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Action queue</CardTitle>
            <CardDescription>
              Open items that need a referee, admin, or player response.
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
                    {item.kind === "staff" ? <ShieldCheck /> : <ClipboardCheck />}
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
                <Badge variant={item.kind === "staff" ? "default" : "secondary"}>
                  {item.kind}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell />
            Notification sources
          </CardTitle>
          <CardDescription>
            Arbiter currently builds this queue from match disputes, score
            reports, roster submissions, evidence, due reminders, and open
            referee claim slots.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
