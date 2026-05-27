import { NoOrgAccess, PageHeader, SimpleTable } from "@/components/dashboard-ui";
import { getAccessContext } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

function fmt(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export default async function AuditPage() {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  if (ctx.orgIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit Log" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const logs = await prisma.auditLog.findMany({
    where: { organizationId: { in: ctx.orgIds } },
    orderBy: { createdAt: "desc" },
    take: 150,
    include: {
      actor: { select: { displayName: true, discordUserId: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description={`${logs.length} most recent operational events across your organizations.`}
      />
      <SimpleTable
        head={["When", "Action", "Target", "Actor"]}
        rows={logs.map((l) => [
          fmt(l.createdAt),
          l.action,
          l.targetType ? `${l.targetType}${l.targetId ? ` ${l.targetId}` : ""}` : "—",
          l.actor?.displayName ?? l.actor?.discordUserId ?? "system",
        ])}
        empty="No audit events recorded."
      />
    </div>
  );
}
