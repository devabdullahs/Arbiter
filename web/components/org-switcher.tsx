"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { AccessibleOrg } from "@/lib/auth-session";
import { switchActiveOrg } from "@/lib/org-actions";

export function OrgSwitcher({
  orgs,
  activeOrgId,
}: {
  orgs: AccessibleOrg[];
  activeOrgId: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = query ? `${pathname}?${query}` : pathname;
  const activeOrg =
    orgs.find((org) => org.id === activeOrgId) ?? orgs[0] ?? null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold">
                {activeOrg ? activeOrg.name[0]?.toUpperCase() : "A"}
              </div>
              <div className="flex min-w-0 flex-col text-left leading-tight">
                <span className="truncate text-sm font-semibold">
                  {activeOrg?.name ?? "Arbiter"}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {activeOrg ? activeOrg.role.toLowerCase() : "No org selected"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto h-4 w-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="start" className="w-64">
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            {orgs.length === 0 ? (
              <DropdownMenuItem disabled>No organizations yet</DropdownMenuItem>
            ) : (
              orgs.map((org) => (
                <DropdownMenuItem key={org.id} asChild>
                  <form action={switchActiveOrg} className="w-full">
                    <input type="hidden" name="orgId" value={org.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button
                      type="submit"
                      className="flex w-full items-center justify-between gap-2 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{org.name}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {org.discordGuildId}
                        </span>
                      </span>
                      <Badge variant={org.id === activeOrg?.id ? "default" : "outline"}>
                        {org.role.toLowerCase()}
                      </Badge>
                    </button>
                  </form>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/org#create-org">
                <Plus className="mr-2 h-4 w-4" />
                Create organization
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
