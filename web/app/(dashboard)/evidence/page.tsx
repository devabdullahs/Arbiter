import Link from "next/link";

import { NoOrgAccess, PageHeader, SimpleTable } from "@/components/dashboard-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAccessContext } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

const STATUSES = ["submitted", "reviewed", "approved", "rejected"];
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

function pageHref(page: number, query: string, status: string, pageSize: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  if (pageSize !== 50) params.set("perPage", String(pageSize));
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/evidence?${suffix}` : "/evidence";
}

export default async function EvidencePage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    page?: string;
    perPage?: string;
  }>;
}) {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  const params = searchParams ? await searchParams : {};
  const query = cleanQuery(params.q);
  const status = STATUSES.includes(String(params.status)) ? String(params.status) : "";
  const page = cleanPage(params.page);
  const pageSize = cleanPageSize(params.perPage);

  if (ctx.orgIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Evidence" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const searchWhere = query
    ? {
        OR: [
          { note: { contains: query, mode: "insensitive" as const } },
          { url: { contains: query, mode: "insensitive" as const } },
          { status: { contains: query, mode: "insensitive" as const } },
          {
            match: {
              publicCode: { contains: query, mode: "insensitive" as const },
            },
          },
          {
            match: {
              teamAName: { contains: query, mode: "insensitive" as const },
            },
          },
          {
            match: {
              teamBName: { contains: query, mode: "insensitive" as const },
            },
          },
          {
            match: {
              organization: {
                name: { contains: query, mode: "insensitive" as const },
              },
            },
          },
        ],
      }
    : {};
  const where = {
    organizationId: { in: ctx.orgIds },
    ...(status ? { status } : {}),
    ...searchWhere,
  };
  const [items, total] = await prisma.$transaction([
    prisma.evidence.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    }),
    prisma.evidence.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence"
        description={`Showing ${items.length} of ${total} matching submissions across your organizations.`}
      />

      <Card>
        <CardContent className="py-4">
          <form className="grid gap-3 md:grid-cols-[1fr_180px_140px_auto]">
            <Input
              name="q"
              defaultValue={query}
              placeholder="Search by match code, team, note, URL, or org"
            />
            <select
              name="status"
              defaultValue={status}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            >
              <option value="">Any status</option>
              {STATUSES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
            <select
              name="perPage"
              defaultValue={String(pageSize)}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry} per page
                </option>
              ))}
            </select>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

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
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages} / {pageSize} per page
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" aria-disabled={page <= 1}>
              <Link
                href={pageHref(Math.max(1, page - 1), query, status, pageSize)}
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
                href={pageHref(
                  Math.min(totalPages, page + 1),
                  query,
                  status,
                  pageSize,
                )}
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
