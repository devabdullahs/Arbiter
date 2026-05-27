"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Gavel,
  Image as ImageIcon,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  Swords,
  Trophy,
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

const nav = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Matches", href: "/matches", icon: Swords },
  { title: "BR Lobbies", href: "/br", icon: Trophy },
  { title: "Referees", href: "/referees", icon: Gavel },
  { title: "Evidence", href: "/evidence", icon: ImageIcon },
  { title: "Audit Log", href: "/audit", icon: ScrollText },
  { title: "Organization", href: "/org", icon: Building2 },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Security", href: "/security", icon: ShieldCheck },
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
            {nav.map((item) => {
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
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
