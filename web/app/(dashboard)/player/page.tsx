import Link from "next/link";

import { PageHeader } from "@/components/dashboard-ui";
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
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/web-authz";

import { createPlayerTeam } from "./actions";

export default async function PlayerDashboardPage() {
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
        organization: { select: { name: true } },
        members: {
          include: { userProfile: { select: { discordUserId: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Player"
        description="Create teams, see teammates, and keep your player-facing work separate from referee tools."
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
            <form action={createPlayerTeam} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <select
                name="organizationId"
                className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
              >
                {memberships.map((membership) => (
                  <option key={membership.id} value={membership.organization.id}>
                    {membership.organization.name}
                  </option>
                ))}
              </select>
              <Input name="name" placeholder="Team name" maxLength={80} required />
              <Button type="submit">Create</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {teams.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              No teams yet.
            </CardContent>
          </Card>
        ) : (
          teams.map((team) => (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{team.name}</CardTitle>
                    <CardDescription>{team.organization.name}</CardDescription>
                  </div>
                  {team.captainProfileId === profile.id ? (
                    <Badge>Captain</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {team.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border p-2 text-sm"
                  >
                    <span>{member.displayName}</span>
                    {member.userProfile?.discordUserId ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/profiles/${member.userProfile.discordUserId}`}>
                          Profile
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
