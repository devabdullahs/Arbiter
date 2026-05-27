import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardBreadcrumbs } from "@/components/dashboard-breadcrumbs";
import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getAccessibleOrgs, getSession } from "@/lib/auth-session";
import { getActiveOrgId } from "@/lib/org-selection";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const [{ orgs }, activeOrgId] = await Promise.all([
    getAccessibleOrgs(session.user.id),
    getActiveOrgId(),
  ]);
  const resolvedActiveOrgId =
    orgs.find((org) => org.id === activeOrgId)?.id ?? orgs[0]?.id ?? null;

  return (
    <SidebarProvider>
      <AppSidebar
        user={session.user}
        orgs={orgs}
        activeOrgId={resolvedActiveOrgId}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 h-4 self-center" />
          <DashboardBreadcrumbs />
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
