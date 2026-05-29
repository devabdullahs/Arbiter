import { NoOrgAccess, PageHeader } from "@/components/dashboard-ui";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAccessContext } from "@/lib/auth-session";
import { OrgMemberRole } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

import { updateOrgWebPermissions } from "../actions";

function canManage(role: OrgMemberRole | undefined) {
  return (
    role === OrgMemberRole.OWNER ||
    role === OrgMemberRole.ADMIN ||
    role === OrgMemberRole.MANAGER
  );
}

export default async function OrgSettingsPage() {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  if (ctx.orgIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Org Settings" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const roleByOrg = new Map(ctx.orgs.map((org) => [org.id, org.role]));
  const orgs = await prisma.organization.findMany({
    where: { id: { in: ctx.orgIds } },
    orderBy: { name: "asc" },
    include: { settings: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Org settings"
        description="Dashboard visibility and organization-wide defaults."
      />

      {orgs.map((org) => {
        const editable = canManage(roleByOrg.get(org.id));
        const webPermissions = (org.settings?.webPermissions ?? {}) as Record<string, boolean>;
        return (
          <Card key={org.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{org.name}</CardTitle>
                  <CardDescription>
                    Control what player and referee roles can see on the web dashboard.
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {(roleByOrg.get(org.id) ?? "").toLowerCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {editable ? (
                <form action={updateOrgWebPermissions} className="flex flex-col gap-4">
                  <input type="hidden" name="organizationId" value={org.id} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["playersCanViewMatches", "Players can view matches"],
                      ["playersCanViewTeams", "Players can view teams"],
                      ["playersCanViewEvidence", "Players can view evidence"],
                      ["refereesCanViewWorkers", "Referees can view worker discovery"],
                    ].map(([name, label]) => (
                      <label
                        key={name}
                        className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          name={name}
                          defaultChecked={Boolean(webPermissions[name])}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <PendingSubmitButton pendingChildren="Saving permissions...">
                    Save permissions
                  </PendingSubmitButton>
                </form>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Only organization owners and admins can edit organization settings.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
