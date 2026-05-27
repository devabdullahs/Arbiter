"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Gavel,
  Image as ImageIcon,
  LayoutDashboard,
  ScrollText,
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

const nav = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Matches", href: "/matches", icon: Swords },
  { title: "BR Lobbies", href: "/br", icon: Trophy },
  { title: "Referees", href: "/referees", icon: Gavel },
  { title: "Evidence", href: "/evidence", icon: ImageIcon },
  { title: "Audit Log", href: "/audit", icon: ScrollText },
  { title: "Organization", href: "/org", icon: Building2 },
  { title: "Security", href: "/security", icon: ShieldCheck },
] as const;

export function AppSidebar({ user }: { user: NavUserData }) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold">
            A
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Arbiter</span>
            <span className="text-muted-foreground text-xs">Dashboard</span>
          </div>
        </div>
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
