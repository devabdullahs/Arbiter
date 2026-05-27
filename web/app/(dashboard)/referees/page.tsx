import Link from "next/link";

import {
  NoOrgAccess,
  PageHeader,
  SimpleTable,
  StatusBadge,
} from "@/components/dashboard-ui";
import { getAccessContext } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export default async function RefereesPage() {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  if (ctx.orgIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Referees" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const orgIds = ctx.orgIds;
  const [shifts, assigned, topWarned] = await Promise.all([
    prisma.refereeShift.findMany({
      where: { organizationId: { in: orgIds }, onShift: true },
      include: {
        userProfile: { select: { displayName: true, discordUserId: true } },
        organization: { select: { name: true } },
      },
    }),
    prisma.match.findMany({
      where: { organizationId: { in: orgIds }, assignedRefereeId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        publicCode: true,
        teamAName: true,
        teamBName: true,
        status: true,
      },
    }),
    prisma.warning.groupBy({
      by: ["player"],
      where: { organizationId: { in: orgIds } },
      _count: { player: true },
      orderBy: { _count: { player: "desc" } },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referees"
        description="On-shift referees, assigned matches, and top flagged players."
      />

      <section className="space-y-2">
        <h2 className="text-sm font-medium">On shift ({shifts.length})</h2>
        <SimpleTable
          head={["Referee", "Organization"]}
          rows={shifts.map((s) => [
            s.userProfile.displayName ?? s.userProfile.discordUserId,
            s.organization.name,
          ])}
          empty="No referees currently on shift."
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">
          Assigned matches ({assigned.length})
        </h2>
        <SimpleTable
          head={["Code", "Match", "Status"]}
          rows={assigned.map((m) => [
            <Link
              key={m.publicCode}
              href={`/matches/${m.publicCode}`}
              className="font-mono hover:underline"
            >
              {m.publicCode}
            </Link>,
            `${m.teamAName} vs ${m.teamBName}`,
            <StatusBadge key="s" status={m.status} />,
          ])}
          empty="No matches are currently assigned to a referee."
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Most-warned players</h2>
        <SimpleTable
          head={["Player", "Warnings"]}
          rows={topWarned.map((w) => [w.player, w._count.player])}
          empty="No warnings recorded."
        />
      </section>
    </div>
  );
}
