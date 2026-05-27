import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { NoOrgAccess, PageHeader } from "@/components/dashboard-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NativeSelect } from "@/components/ui/native-select";
import { getAccessContext } from "@/lib/auth-session";
import { botInviteUrl, listDiscordGuildOptions } from "@/lib/discord";
import { OrgMemberRole } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

import {
  createOrgInvite,
  revokeOrgInvite,
  updateOrgWebPermissions,
} from "./actions";
import { CreateOrganizationCard } from "./create-organization-card";

const ROLE_ORDER: Record<string, number> = {
  OWNER: 0,
  ADMIN: 1,
  REFEREE: 2,
  PLAYER: 3,
};

export default async function OrgPage() {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  const discordGuildOptions = ctx.discordId
    ? await listDiscordGuildOptions(ctx.session.user.id)
    : { guilds: [], needsReconnect: false };
  const genericInviteUrl = botInviteUrl();

  if (ctx.orgIds.length === 0) {
    if (ctx.activeOrg) {
      return (
        <div className="space-y-6">
          <PageHeader
            title="Organization"
            description="Your player-facing organization view."
          />
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{ctx.activeOrg.name}</CardTitle>
                <Badge variant="secondary">
                  {ctx.activeOrg.role.toLowerCase()}
                </Badge>
              </div>
              <CardDescription>
                Guild {ctx.activeOrg.discordGuildId}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground text-sm">
                This account is connected as a player. Use the player workspace
                for teams, match visibility, and check-ins. Ref/admin settings
                appear here when your role is upgraded.
              </p>
              <Button asChild variant="outline">
                <Link href="/player">Open player workspace</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <PageHeader title="Organization" />
        <NoOrgAccess discordId={ctx.discordId} />
        {ctx.discordId ? (
          <CreateOrganizationCard
            guilds={discordGuildOptions.guilds}
            needsReconnect={discordGuildOptions.needsReconnect}
            genericInviteUrl={genericInviteUrl}
          />
        ) : null}
      </div>
    );
  }

  const roleByOrg = new Map(ctx.orgs.map((o) => [o.id, o.role]));
  const orgs = await prisma.organization.findMany({
    where: { id: { in: ctx.orgIds } },
    orderBy: { name: "asc" },
    include: {
      settings: true,
      members: {
        include: {
          userProfile: { select: { displayName: true, discordUserId: true } },
        },
      },
      invites: {
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: { select: { matches: true, brLobbies: true, members: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization"
        description="Settings and membership for the selected organization."
      />

      <CreateOrganizationCard
        guilds={discordGuildOptions.guilds}
        needsReconnect={discordGuildOptions.needsReconnect}
        genericInviteUrl={genericInviteUrl}
      />

      {orgs.map((org) => {
        const s = org.settings;
        const currentRole = roleByOrg.get(org.id);
        const canManageInvites =
          currentRole === OrgMemberRole.OWNER ||
          currentRole === OrgMemberRole.ADMIN;
        const members = [...org.members]
          .sort(
            (a, b) =>
              (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
              (a.userProfile.displayName ?? "").localeCompare(
                b.userProfile.displayName ?? "",
              ),
          )
          .slice(0, 50);
        const webPermissions = (s?.webPermissions ?? {}) as Record<string, boolean>;

        return (
          <Card key={org.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{org.name}</CardTitle>
                <Badge variant="secondary">
                  {(currentRole ?? "").toLowerCase()}
                </Badge>
              </div>
              <CardDescription>
                Guild {org.discordGuildId} - {org._count.members} members -{" "}
                {org._count.matches} matches - {org._count.brLobbies} BR lobbies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={s?.adminRoleId ? "secondary" : "outline"}>
                  Admin role {s?.adminRoleId ? "set" : "unset"}
                </Badge>
                <Badge variant={s?.refereeRoleId ? "secondary" : "outline"}>
                  Referee role {s?.refereeRoleId ? "set" : "unset"}
                </Badge>
                <Badge variant={s?.matchLogChannelId ? "secondary" : "outline"}>
                  Match log {s?.matchLogChannelId ? "set" : "unset"}
                </Badge>
                <Badge variant={s?.evidenceChannelId ? "secondary" : "outline"}>
                  Evidence vault {s?.evidenceChannelId ? "set" : "unset"}
                </Badge>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-muted-foreground py-6 text-center"
                      >
                        No members saved.
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          {m.userProfile.displayName ??
                            m.userProfile.discordUserId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {m.role.toLowerCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {org._count.members > members.length ? (
                <p className="text-muted-foreground text-xs">
                  Showing {members.length} of {org._count.members} members.
                </p>
              ) : null}

              {canManageInvites ? (
                <div className="grid gap-4 border-t pt-4 md:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
                  <div>
                    <h3 className="text-sm font-medium">Pending invites</h3>
                    <p className="text-muted-foreground mb-3 text-xs">
                      Email invites extend Arbiter&apos;s existing Discord-based
                      org membership. Invitees still need to sign in and link
                      Discord before access is granted.
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {org.invites.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-muted-foreground py-6 text-center"
                            >
                              No pending invites.
                            </TableCell>
                          </TableRow>
                        ) : (
                          org.invites.map((invite) => (
                            <TableRow key={invite.id}>
                              <TableCell>{invite.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {invite.role.toLowerCase()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {invite.expiresAt.toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <form action={revokeOrgInvite}>
                                  <input
                                    type="hidden"
                                    name="inviteId"
                                    value={invite.id}
                                  />
                                  <ConfirmSubmitButton
                                    type="submit"
                                    size="sm"
                                    variant="ghost"
                                    confirmMessage={`Revoke the invite for ${invite.email}?`}
                                  >
                                    Revoke
                                  </ConfirmSubmitButton>
                                </form>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <form action={createOrgInvite} className="space-y-3">
                    <input type="hidden" name="organizationId" value={org.id} />
                    <div>
                      <label
                        htmlFor={`invite-email-${org.id}`}
                        className="text-sm font-medium"
                      >
                        Invite by email
                      </label>
                      <input
                        id={`invite-email-${org.id}`}
                        name="email"
                        type="email"
                        required
                        placeholder="referee@event.gg"
                        className="border-input bg-background mt-1 h-8 w-full rounded-lg border px-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`invite-role-${org.id}`}
                        className="text-sm font-medium"
                      >
                        Role
                      </label>
                      <NativeSelect
                        id={`invite-role-${org.id}`}
                        name="role"
                        defaultValue={OrgMemberRole.REFEREE}
                        className="h-8"
                        wrapperClassName="mt-1"
                      >
                        <option value={OrgMemberRole.REFEREE}>Referee</option>
                        <option value={OrgMemberRole.ADMIN}>Admin</option>
                        <option value={OrgMemberRole.PLAYER}>Player</option>
                      </NativeSelect>
                    </div>
                    <Button type="submit">Send invite</Button>
                  </form>
                </div>
              ) : null}

              {canManageInvites ? (
                <form action={updateOrgWebPermissions} className="space-y-3 border-t pt-4">
                  <input type="hidden" name="organizationId" value={org.id} />
                  <div>
                    <h3 className="text-sm font-medium">Web permissions</h3>
                    <p className="text-muted-foreground text-xs">
                      Control what non-admin roles can see in the dashboard.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["playersCanViewMatches", "Players can view matches"],
                      ["playersCanViewTeams", "Players can view teams"],
                      ["playersCanViewEvidence", "Players can view evidence"],
                      ["refereesCanViewWorkers", "Referees can view worker discovery"],
                    ].map(([name, label]) => (
                      <label key={name} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                        <input
                          type="checkbox"
                          name={name}
                          defaultChecked={Boolean(webPermissions[name])}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <Button type="submit">Save permissions</Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
