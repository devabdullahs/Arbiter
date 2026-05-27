import Link from "next/link";

import { NoOrgAccess, PageHeader, SimpleTable } from "@/components/dashboard-ui";
import { Badge } from "@/components/ui/badge";
import { getAccessContext } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

function fmt(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export default async function EvidencePage() {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  if (ctx.orgIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Evidence" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const items = await prisma.evidence.findMany({
    where: { organizationId: { in: ctx.orgIds } },
    orderBy: { createdAt: "desc" },
    take: 150,
    include: { match: { select: { publicCode: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence"
        description={`${items.length} most recent submissions across your organizations.`}
      />
      <SimpleTable
        head={["Match", "Status", "Note", "Link", "When"]}
        rows={items.map((e) => [
          <Link
            key="m"
            href={`/matches/${e.match.publicCode}`}
            className="font-mono hover:underline"
          >
            {e.match.publicCode}
          </Link>,
          <Badge key="s" variant="outline">
            {e.status}
          </Badge>,
          e.note ?? "—",
          <a
            key="l"
            href={e.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            View
          </a>,
          fmt(e.createdAt),
        ])}
        empty="No evidence submitted yet."
      />
    </div>
  );
}
