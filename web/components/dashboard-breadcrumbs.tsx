"use client";

import Link from "next/link";
import { ChevronRight, Home, MoreHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  audit: "Audit Log",
  br: "BR Lobbies",
  dashboard: "Overview",
  evidence: "Evidence",
  matches: "Matches",
  org: "Organization",
  player: "Player",
  profiles: "Profiles",
  referees: "Referees",
  security: "Login & Security",
  settings: "Profile",
  workers: "Workers",
};

type Crumb = {
  href: string;
  label: string;
};

function segmentLabel(segment: string) {
  const decoded = decodeURIComponent(segment);
  if (LABELS[decoded]) return LABELS[decoded];
  if (/^[a-z0-9]{6,}$/i.test(decoded)) return decoded.toUpperCase();
  return decoded
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function crumbsForPath(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ href: "/dashboard", label: "Home" }];
  let href = "";

  for (const segment of segments) {
    href += `/${segment}`;
    crumbs.push({ href, label: segmentLabel(segment) });
  }

  return crumbs;
}

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const crumbs = crumbsForPath(pathname);
  const compact = crumbs.length > 4;
  const visibleCrumbs = compact
    ? [crumbs[0], crumbs[crumbs.length - 2], crumbs[crumbs.length - 1]]
    : crumbs;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-1 items-center gap-1 text-sm"
    >
      {visibleCrumbs.map((crumb, index) => {
        const isLast = index === visibleCrumbs.length - 1;
        const showCompactGap = compact && index === 1;

        return (
          <div key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
            ) : null}
            {showCompactGap ? (
              <>
                <span className="text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                  <MoreHorizontal className="size-4" />
                </span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </>
            ) : null}
            {isLast ? (
              <span
                aria-current="page"
                className="min-w-0 truncate font-medium text-foreground"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 transition-colors"
              >
                {index === 0 ? <Home className="size-4 shrink-0" /> : null}
                <span className="truncate">{crumb.label}</span>
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
