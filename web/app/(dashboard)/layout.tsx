import { redirect } from "next/navigation";
import type { Metadata } from "next";

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
import { getTodoSummary } from "@/lib/todos";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

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
  const todoSummary = await getTodoSummary(
    session.user.id,
    orgs,
    resolvedActiveOrgId,
  );

  return (
    <SidebarProvider>
      <AppSidebar
        user={session.user}
        orgs={orgs}
        activeOrgId={resolvedActiveOrgId}
        staffTodoCount={todoSummary.staffTotal}
        playerNotificationCount={todoSummary.playerTotal}
      />
      <SidebarInset className="min-w-0">
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1 h-4 self-center" />
          <DashboardBreadcrumbs />
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
