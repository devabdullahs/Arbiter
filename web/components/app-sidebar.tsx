"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Bell,
  ClipboardCheck,
  ClipboardList,
  Gavel,
  Image as ImageIcon,
  LayoutDashboard,
  Shield,
  Search,
  ScrollText,
  Settings,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
  Network,
  SlidersHorizontal,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavUser, type NavUserData } from "@/components/nav-user";
import { OrgSwitcher } from "@/components/org-switcher";
import type { AccessibleOrg } from "@/lib/auth-session";

const staffNav = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Matches", href: "/matches", icon: Swords },
  { title: "Tournaments", href: "/tournaments", icon: Network },
  { title: "BR Lobbies", href: "/br", icon: Trophy },
  { title: "Referees", href: "/referees", icon: Gavel },
  { title: "Workers", href: "/workers", icon: Search },
  { title: "Evidence", href: "/evidence", icon: ImageIcon },
  { title: "Audit Log", href: "/audit", icon: ScrollText },
] as const;

const playerNav = [
  { title: "Workspace", href: "/player", icon: Users },
  { title: "My Matches", href: "/player/matches", icon: Swords },
  { title: "My Teams", href: "/player/teams", icon: Users },
  { title: "Check-ins", href: "/player/checkins", icon: ClipboardCheck },
] as const;

const organizationNav = [
  { title: "Organization", href: "/org", icon: Building2 },
  { title: "Announcements", href: "/org/announcements", icon: Bell },
  { title: "Presets", href: "/org/presets", icon: ClipboardList },
  { title: "Rulings", href: "/org/rulings", icon: Gavel },
  { title: "Org Settings", href: "/org/settings", icon: SlidersHorizontal },
] as const;

const accountNav = [
  { title: "Profile", href: "/settings", icon: Settings },
  { title: "Login & Security", href: "/security", icon: ShieldCheck },
] as const;

export function AppSidebar({
  user,
  orgs,
  activeOrgId,
  todoCount = 0,
  staffTodoCount = 0,
  playerNotificationCount = 0,
}: {
  user: NavUserData;
  orgs: AccessibleOrg[];
  activeOrgId: string | null;
  todoCount?: number;
  staffTodoCount?: number;
  playerNotificationCount?: number;
}) {
  const pathname = usePathname();
  const activeOrg =
    orgs.find((org) => org.id === activeOrgId) ?? orgs[0] ?? null;
  const staffView =
    activeOrg?.role === "OWNER" ||
    activeOrg?.role === "ADMIN" ||
    activeOrg?.role === "MANAGER" ||
    activeOrg?.role === "HEAD_REF" ||
    activeOrg?.role === "REFEREE";
  const resolvedStaffTodoCount = staffTodoCount || todoCount;

  return (
    <Sidebar>
      <SidebarHeader>
        <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId} />
      </SidebarHeader>
      <SidebarContent>
        {staffView ? (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Shield className="mr-1 size-3" />
              Ref/Admin View
            </SidebarGroupLabel>
            <SidebarMenu>
              {staffNav.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
        <SidebarGroup>
          <SidebarGroupLabel>Player View</SidebarGroupLabel>
          <SidebarMenu>
            {playerNav.map((item) => {
              const active =
                item.href === "/player"
                  ? pathname === "/player"
                  : pathname.startsWith(item.href);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Organization</SidebarGroupLabel>
          <SidebarMenu>
            {organizationNav.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={
                    item.href === "/org"
                      ? pathname === "/org"
                      : pathname.startsWith(item.href)
                  }
                  tooltip={item.title}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarMenu>
            {accountNav.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={item.title}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {staffView ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith("/todo")}
                tooltip="Staff to-do"
              >
                <Link href="/todo">
                  <ClipboardList />
                  <span>To-do</span>
                  {resolvedStaffTodoCount > 0 ? (
                    <span className="bg-primary text-primary-foreground ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                      {resolvedStaffTodoCount > 99 ? "99+" : resolvedStaffTodoCount}
                    </span>
                  ) : null}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith("/notifications")}
              tooltip="Player notifications"
            >
              <Link href="/notifications">
                <Bell />
                <span>Notifications</span>
                {playerNotificationCount > 0 ? (
                  <span className="bg-primary text-primary-foreground ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                    {playerNotificationCount > 99 ? "99+" : playerNotificationCount}
                  </span>
                ) : null}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
