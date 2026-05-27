"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Gavel,
  Image as ImageIcon,
  LayoutDashboard,
  Search,
  ScrollText,
  Settings,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
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

const operationsNav = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Matches", href: "/matches", icon: Swords },
  { title: "BR Lobbies", href: "/br", icon: Trophy },
  { title: "Referees", href: "/referees", icon: Gavel },
  { title: "Workers", href: "/workers", icon: Search },
  { title: "Player", href: "/player", icon: Users },
  { title: "Evidence", href: "/evidence", icon: ImageIcon },
  { title: "Audit Log", href: "/audit", icon: ScrollText },
] as const;

const organizationNav = [
  { title: "Organization", href: "/org", icon: Building2 },
] as const;

const accountNav = [
  { title: "Profile", href: "/settings", icon: Settings },
  { title: "Login & Security", href: "/security", icon: ShieldCheck },
] as const;

export function AppSidebar({
  user,
  orgs,
  activeOrgId,
}: {
  user: NavUserData;
  orgs: AccessibleOrg[];
  activeOrgId: string | null;
}) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarMenu>
            {operationsNav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
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
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
