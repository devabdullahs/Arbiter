"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Home, MoreHorizontal } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

const LABELS: Record<string, string> = {
  audit: "Audit Log",
  br: "BR Lobbies",
  dashboard: "Overview",
  evidence: "Evidence",
  matches: "Matches",
  org: "Organization",
  player: "Player",
  profiles: "Profile",
  referees: "Referees",
  security: "Login & Security",
  settings: "Profile",
  tournaments: "Tournaments",
  workers: "Workers",
};

type Crumb = {
  href: string;
  label: string;
};

const PROFILE_PARENT_KEY = "arbiter.profileBreadcrumbParent";

const PROFILE_PARENTS: Record<string, Crumb> = {
  player: { href: "/player", label: "Player" },
  settings: { href: "/settings", label: "Profile" },
  workers: { href: "/workers", label: "Workers" },
};

function normalizeProfileParent(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "profile") return "settings";
  if (normalized === "players") return "player";
  return PROFILE_PARENTS[normalized] ? normalized : null;
}

function profileParentFromPath(pathname: string) {
  if (pathname === "/player" || pathname.startsWith("/player/")) return "player";
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return "settings";
  if (pathname === "/workers" || pathname.startsWith("/workers/")) return "workers";
  return null;
}

function segmentLabel(segment: string) {
  const decoded = decodeURIComponent(segment);
  if (LABELS[decoded]) return LABELS[decoded];
  if (/^[a-z0-9]{6,}$/i.test(decoded)) return decoded.toUpperCase();
  return decoded
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function crumbsForPath(pathname: string, from: string | null): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ href: "/dashboard", label: "Home" }];

  // /profiles/[discordId] has no /profiles index page. Show where the viewer
  // came from (the player or workers list) as the parent crumb — a real link —
  // instead of a broken /profiles link, mirroring the page's "Back to ..." button.
  if (segments[0] === "profiles" && segments.length >= 2) {
    // Mirror the profile page's "Back to ..." target based on where the viewer
    // came from: their own settings preview, the player list, or the workers list.
    crumbs.push(PROFILE_PARENTS[from ?? ""] ?? PROFILE_PARENTS.workers);
    crumbs.push({
      href: `/profiles/${segments[1]}`,
      label: segmentLabel(segments[1]),
    });
    return crumbs;
  }

  let href = "";
  for (const segment of segments) {
    href += `/${segment}`;
    crumbs.push({ href, label: segmentLabel(segment) });
  }

  return crumbs;
}

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeProfileParent = normalizeProfileParent(searchParams.get("from"));
  const storedProfileParent =
    typeof window === "undefined"
      ? null
      : normalizeProfileParent(window.sessionStorage.getItem(PROFILE_PARENT_KEY));

  useEffect(() => {
    const parentFromPath = profileParentFromPath(pathname);
    if (parentFromPath) {
      window.sessionStorage.setItem(PROFILE_PARENT_KEY, parentFromPath);
    }
  }, [pathname]);

  const crumbs = crumbsForPath(pathname, routeProfileParent ?? storedProfileParent);
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
