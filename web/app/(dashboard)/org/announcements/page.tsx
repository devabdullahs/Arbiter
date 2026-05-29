import { Megaphone } from "lucide-react";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState, PageHeader } from "@/components/dashboard-ui";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getAccessContext } from "@/lib/auth-session";
import { formatDateTime } from "@/lib/format-date";
import { OrgMemberRole } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

import {
  archiveOrgAnnouncement,
  createOrgAnnouncement,
} from "../actions";

const ANNOUNCEMENT_MANAGER_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.OWNER,
  OrgMemberRole.ADMIN,
  OrgMemberRole.MANAGER,
  OrgMemberRole.HEAD_REF,
]);

function targetLabel(kind: string, value: string | null) {
  if (kind === "everyone") return "Everyone";
  if (kind === "staff") return "All operators/workers";
  if (kind === "players") return "All players";
  if (kind === "org_role") return `Org role: ${(value ?? "").toLowerCase()}`;
  if (kind === "team_role") return `Team role: ${value?.replaceAll("_", " ")}`;
  return kind;
}

export default async function AnnouncementsPage() {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  const orgs = await prisma.organization.findMany({
    where: { id: { in: ctx.orgs.map((org) => org.id) } },
    select: {
      id: true,
      name: true,
      announcements: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          createdBy: { select: { displayName: true, discordUserId: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  const roleByOrg = new Map(ctx.orgs.map((org) => [org.id, org.role]));
  const writableOrgs = orgs.filter((org) =>
    ANNOUNCEMENT_MANAGER_ROLES.has(roleByOrg.get(org.id) ?? OrgMemberRole.PLAYER),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Send scoped alerts to operators, players, coaches, team leaders, or everyone in an organization."
      />

      {writableOrgs.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create announcement</CardTitle>
            <CardDescription>
              Announcements appear in the dashboard notification feed only for
              people who match the selected audience.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createOrgAnnouncement} className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="space-y-1">
                  <span className="text-sm font-medium">Organization</span>
                  <NativeSelect name="organizationId" className="h-9" required>
                    {writableOrgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Title</span>
                  <Input
                    name="title"
                    placeholder="Lobby ready check starts in 10 minutes"
                    maxLength={120}
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Message</span>
                  <textarea
                    name="body"
                    rows={5}
                    maxLength={1200}
                    required
                    placeholder="Write the operational update, player instruction, or callout..."
                    className="border-input bg-background min-h-28 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </label>
              </div>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium">Audience</span>
                    <NativeSelect name="targetKind" defaultValue="everyone" className="h-9">
                      <option value="everyone">Everyone</option>
                      <option value="staff">All operators/workers</option>
                      <option value="players">All players</option>
                      <option value="org_role">Specific org role</option>
                      <option value="team_role">Specific team role</option>
                    </NativeSelect>
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium">Role value</span>
                    <NativeSelect name="targetValue" defaultValue="" className="h-9">
                      <option value="">Not needed</option>
                      <option value={OrgMemberRole.OWNER}>Owner</option>
                      <option value={OrgMemberRole.ADMIN}>Admin</option>
                      <option value={OrgMemberRole.MANAGER}>Manager</option>
                      <option value={OrgMemberRole.HEAD_REF}>Head referee</option>
                      <option value={OrgMemberRole.REFEREE}>Referee</option>
                      <option value={OrgMemberRole.PLAYER}>Player</option>
                      <option value="coach">Coach</option>
                      <option value="manager">Team manager</option>
                      <option value="team_leader">Team leader</option>
                      <option value="player">Team player</option>
                    </NativeSelect>
                  </label>
                </div>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Expires at</span>
                  <Input name="expiresAt" type="datetime-local" />
                </label>
                <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                  Examples: send lobby instructions to all players, urgent
                  staffing notes to all operators/workers, or side-selection
                  reminders only to coaches and team leaders.
                </div>
                <PendingSubmitButton pendingChildren="Publishing...">
                  Publish announcement
                </PendingSubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {orgs.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No organizations"
            description="Join or create an organization before sending announcements."
          />
        ) : null}
        {orgs.map((org) => (
          <Card key={org.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{org.name}</CardTitle>
                  <CardDescription>
                    Active targeted announcements.
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  {(roleByOrg.get(org.id) ?? "").toLowerCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {org.announcements.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
                  No active announcements.
                </p>
              ) : (
                org.announcements.map((announcement) => {
                  const canArchive = ANNOUNCEMENT_MANAGER_ROLES.has(
                    roleByOrg.get(org.id) ?? OrgMemberRole.PLAYER,
                  );
                  return (
                    <div
                      key={announcement.id}
                      className="grid gap-3 rounded-lg border p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{announcement.title}</h3>
                          <Badge variant="secondary">
                            {targetLabel(
                              announcement.targetKind,
                              announcement.targetValue,
                            )}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {announcement.body}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          By{" "}
                          {announcement.createdBy?.displayName ??
                            announcement.createdBy?.discordUserId ??
                            "Unknown"}{" "}
                          · {formatDateTime(announcement.createdAt)}
                          {announcement.expiresAt
                            ? ` · expires ${formatDateTime(announcement.expiresAt)}`
                            : ""}
                        </p>
                      </div>
                      {canArchive ? (
                        <form action={archiveOrgAnnouncement}>
                          <input
                            type="hidden"
                            name="announcementId"
                            value={announcement.id}
                          />
                          <ConfirmSubmitButton
                            type="submit"
                            variant="outline"
                            size="sm"
                            confirmMessage={`Archive "${announcement.title}"?`}
                          >
                            Archive
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
