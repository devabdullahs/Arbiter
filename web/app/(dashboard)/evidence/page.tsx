import Link from "next/link";

import { NoOrgAccess, PageHeader, SimpleTable } from "@/components/dashboard-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    include: {
      match: {
        select: {
          publicCode: true,
          teamAName: true,
          teamBName: true,
          organization: { select: { name: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence"
        description={`${items.length} most recent submissions across your organizations.`}
      />

      <div className="grid gap-3 md:hidden">
        {items.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              No evidence submitted yet.
            </CardContent>
          </Card>
        ) : (
          items.map((e) => (
            <Card key={e.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/matches/${e.match.publicCode}`}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      {e.match.publicCode}
                    </Link>
                    <h2 className="truncate text-base font-semibold">
                      {e.match.teamAName} vs {e.match.teamBName}
                    </h2>
                    <p className="text-muted-foreground truncate text-xs">
                      {e.match.organization.name} / {fmt(e.createdAt)}
                    </p>
                  </div>
                  <Badge variant="outline">{e.status}</Badge>
                </div>
                {e.note ? (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {e.note}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline">
                    <Link href={`/matches/${e.match.publicCode}`}>Match</Link>
                  </Button>
                  <Button asChild>
                    <a href={e.url} target="_blank" rel="noopener noreferrer">
                      Evidence
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="hidden md:block">
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
            e.note ?? "-",
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
    </div>
  );
}
