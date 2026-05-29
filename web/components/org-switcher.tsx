"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";

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

function SwitchOrgButton({
  name,
  discordGuildId,
  role,
  active,
}: {
  name: string;
  discordGuildId: string;
  role: string;
  active: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || active}
      className="flex w-full items-center justify-between gap-2 text-left disabled:cursor-wait disabled:opacity-70"
    >
      <span className="min-w-0">
        <span className="block truncate">{pending ? "Switching..." : name}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {discordGuildId}
        </span>
      </span>
      <Badge variant={active ? "default" : "outline"}>{role.toLowerCase()}</Badge>
    </button>
  );
}

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
                    <SwitchOrgButton
                      name={org.name}
                      discordGuildId={org.discordGuildId}
                      role={org.role}
                      active={org.id === activeOrg?.id}
                    />
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
