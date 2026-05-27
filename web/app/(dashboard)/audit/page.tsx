import Link from "next/link";

import { NoOrgAccess, PageHeader, SimpleTable } from "@/components/dashboard-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getAccessContext } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

function fmt(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function cleanQuery(value: string | undefined) {
  return String(value ?? "").trim().slice(0, 120);
}

function cleanPage(value: string | undefined) {
  const page = Number.parseInt(String(value ?? "1"), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function cleanPageSize(value: string | undefined) {
  const parsed = Number.parseInt(String(value ?? "50"), 10);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : 50;
}

function pageHref(page: number, query: string, pageSize: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (pageSize !== 50) params.set("perPage", String(pageSize));
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/audit?${suffix}` : "/audit";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; page?: string; perPage?: string }>;
}) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  const params = searchParams ? await searchParams : {};
  const query = cleanQuery(params.q);
  const page = cleanPage(params.page);
  const pageSize = cleanPageSize(params.perPage);

  if (ctx.orgIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit Log" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const where = {
    organizationId: { in: ctx.orgIds },
    ...(query
      ? {
          OR: [
            { action: { contains: query, mode: "insensitive" as const } },
            { targetType: { contains: query, mode: "insensitive" as const } },
            { targetId: { contains: query, mode: "insensitive" as const } },
            {
              actor: {
                displayName: { contains: query, mode: "insensitive" as const },
              },
            },
            {
              actor: {
                discordUserId: { contains: query, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };
  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        actor: { select: { displayName: true, discordUserId: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description={`Showing ${logs.length} of ${total} matching operational events across your organizations.`}
      />
      <Card>
        <CardContent className="py-4">
          <form className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
            <Input
              name="q"
              defaultValue={query}
              placeholder="Search by action, target, actor, or Discord ID"
            />
            <NativeSelect
              name="perPage"
              defaultValue={String(pageSize)}
            >
              {PAGE_SIZE_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry} per page
                </option>
              ))}
            </NativeSelect>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>
      <SimpleTable
        head={["When", "Action", "Target", "Actor"]}
        rows={logs.map((log) => [
          fmt(log.createdAt),
          log.action,
          log.targetType
            ? `${log.targetType}${log.targetId ? ` ${log.targetId}` : ""}`
            : "-",
          log.actor?.displayName ?? log.actor?.discordUserId ?? "system",
        ])}
        empty="No audit events recorded."
      />
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages} / {pageSize} per page
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" aria-disabled={page <= 1}>
              <Link
                href={pageHref(Math.max(1, page - 1), query, pageSize)}
                className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
              >
                Previous
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              aria-disabled={page >= totalPages}
            >
              <Link
                href={pageHref(Math.min(totalPages, page + 1), query, pageSize)}
                className={
                  page >= totalPages ? "pointer-events-none opacity-50" : undefined
                }
              >
                Next
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
