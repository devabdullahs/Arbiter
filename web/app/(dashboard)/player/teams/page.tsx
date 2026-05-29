import Link from "next/link";
import { Users } from "lucide-react";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState, PageHeader } from "@/components/dashboard-ui";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/web-authz";

import {
  addTeamMember,
  createPlayerTeam,
  removeTeamMember,
  updateTeamMemberRole,
} from "../actions";

function teamRoleLabel(role: string) {
  const labels: Record<string, string> = {
    player: "Player",
    substitute: "Substitute",
    coach: "Coach",
    manager: "Manager",
    team_leader: "Team leader",
  };
  return labels[role] ?? "Player";
}

export default async function PlayerTeamsPage() {
  const { profile } = await requireUserProfile();
  const [memberships, teams] = await Promise.all([
    prisma.orgMember.findMany({
      where: { userProfileId: profile.id },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { organization: { name: "asc" } },
    }),
    prisma.team.findMany({
      where: {
        OR: [
          { captainProfileId: profile.id },
          { members: { some: { userProfileId: profile.id } } },
        ],
      },
      include: {
        organization: { select: { id: true, name: true } },
        members: {
          include: { userProfile: { select: { discordUserId: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Teams"
        description="Create teams, add players, and assign player-side roles like coach, manager, and team leader."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create team</CardTitle>
          <CardDescription>
            Teams are created inside an organization you already belong to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {memberships.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Join an organization before creating a team.
            </p>
          ) : (
            <form
              action={createPlayerTeam}
              className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
            >
              <NativeSelect name="organizationId" className="h-8">
                {memberships.map((membership) => (
                  <option key={membership.id} value={membership.organization.id}>
                    {membership.organization.name}
                  </option>
                ))}
              </NativeSelect>
              <Input name="name" placeholder="Team name" maxLength={80} required />
              <PendingSubmitButton pendingChildren="Creating...">
                Create
              </PendingSubmitButton>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {teams.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              icon={Users}
              title="No teams yet"
              description="Create a team above to add players and assign roles."
            />
          </div>
        ) : (
          teams.map((team) => {
            const isCaptain = team.captainProfileId === profile.id;
            const isManager = team.members.some(
              (member) =>
                member.userProfileId === profile.id &&
                (member.teamRole === "manager" ||
                  member.teamRole === "team_leader"),
            );
            const canManageRoles = isCaptain || isManager;
            return (
              <Card key={team.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{team.name}</CardTitle>
                      <CardDescription>{team.organization.name}</CardDescription>
                    </div>
                    {isCaptain ? <Badge>Captain</Badge> : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isCaptain ? (
                    <form
                      action={addTeamMember}
                      className="space-y-2 rounded-lg border p-3"
                    >
                      <input type="hidden" name="teamId" value={team.id} />
                      <Input
                        name="displayName"
                        placeholder="Player display name"
                        maxLength={80}
                      />
                      <Input
                        name="discordUserId"
                        placeholder="Discord user ID (optional)"
                        inputMode="numeric"
                      />
                      <NativeSelect
                        name="teamRole"
                        defaultValue="player"
                        className="h-8"
                      >
                        <option value="player">Player</option>
                        <option value="substitute">Substitute</option>
                        <option value="coach">Coach</option>
                        <option value="manager">Manager</option>
                        <option value="team_leader">Team leader</option>
                      </NativeSelect>
                      <PendingSubmitButton
                        className="w-full"
                        variant="outline"
                        pendingChildren="Adding..."
                      >
                        Add teammate
                      </PendingSubmitButton>
                    </form>
                  ) : null}

                  {team.members.map((member) => {
                    const isCaptainMember =
                      member.userProfileId === team.captainProfileId;
                    return (
                      <div
                        key={member.id}
                        className="space-y-2 rounded-lg border p-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate">
                              {member.displayName}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {teamRoleLabel(member.teamRole)}
                              {isCaptainMember ? " / owner" : ""}
                            </span>
                          </span>
                          <div className="flex items-center gap-1">
                            {member.userProfile?.discordUserId ? (
                              <Button asChild variant="ghost" size="sm">
                                <Link
                                  href={`/profiles/${member.userProfile.discordUserId}?from=player`}
                                >
                                  Profile
                                </Link>
                              </Button>
                            ) : null}
                            {isCaptain && member.userProfileId !== profile.id ? (
                              <form action={removeTeamMember}>
                                <input
                                  type="hidden"
                                  name="memberId"
                                  value={member.id}
                                />
                                <ConfirmSubmitButton
                                  type="submit"
                                  variant="ghost"
                                  size="sm"
                                  confirmMessage={`Remove ${member.displayName} from ${team.name}?`}
                                >
                                  Remove
                                </ConfirmSubmitButton>
                              </form>
                            ) : null}
                          </div>
                        </div>
                        {canManageRoles && !isCaptainMember ? (
                          <form
                            action={updateTeamMemberRole}
                            className="grid grid-cols-[1fr_auto] gap-2"
                          >
                            <input
                              type="hidden"
                              name="memberId"
                              value={member.id}
                            />
                            <NativeSelect
                              key={member.teamRole}
                              name="teamRole"
                              defaultValue={member.teamRole}
                              className="h-8"
                            >
                              <option value="player">Player</option>
                              <option value="substitute">Substitute</option>
                              <option value="coach">Coach</option>
                              <option value="manager">Manager</option>
                              <option value="team_leader">Team leader</option>
                            </NativeSelect>
                            <PendingSubmitButton
                              variant="outline"
                              size="sm"
                              pendingChildren="Saving..."
                            >
                              Save role
                            </PendingSubmitButton>
                          </form>
                        ) : null}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
