import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader, StatusBadge } from "@/components/dashboard-ui";
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
import { MatchStatus } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/web-authz";

import {
  addTeamMember,
  createPlayerTeam,
  removeTeamMember,
  submitPlayerCheckin,
} from "./actions";

function fmt(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function canCheckIn(status: MatchStatus) {
  return (
    status === MatchStatus.PENDING ||
    status === MatchStatus.VETO ||
    status === MatchStatus.LIVE
  );
}

export default async function PlayerDashboardPage() {
  const { profile } = await requireUserProfile();
  const [memberships, teams, recentCheckins] = await Promise.all([
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
      take: 50,
    }),
    prisma.checkin.findMany({
      where: { userProfileId: profile.id },
      include: {
        match: {
          select: {
            publicCode: true,
            teamAName: true,
            teamBName: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  const teamIds = teams.map((team) => team.id);
  const matches = teamIds.length
    ? await prisma.match.findMany({
        where: {
          participants: { some: { teamId: { in: teamIds } } },
        },
        include: {
          organization: { select: { name: true } },
          participants: {
            include: { team: { select: { id: true, name: true } } },
            orderBy: { slot: "asc" },
          },
          checkins: {
            where: { userProfileId: profile.id },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 30,
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Player"
        description="Your team, match, and check-in workspace."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Player profile</CardTitle>
            <CardDescription>Linked Discord {profile.discordUserId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-medium">
                {profile.displayName ?? profile.discordUserId}
              </p>
              <p className="text-muted-foreground text-sm">
                {profile.countryCode ?? "No country set"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.openToWork ? <Badge>Open to work</Badge> : null}
              {profile.gameExperiences.slice(0, 3).map((game) => (
                <Badge key={game} variant="secondary">
                  {game}
                </Badge>
              ))}
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/settings">Edit profile</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Organizations</CardTitle>
            <CardDescription>
              Places where Arbiter knows you as a player, referee, admin, or owner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {memberships.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                You are not connected to an organization yet.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {memberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <span className="font-medium">{membership.organization.name}</span>
                    <Badge variant="outline">{membership.role.toLowerCase()}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">My matches</h2>
          <Badge variant="outline">{matches.length} matches</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {matches.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground py-8 text-center text-sm">
                No matches are linked to your teams yet.
              </CardContent>
            </Card>
          ) : (
            matches.map((match) => {
              const myTeams = match.participants
                .filter((participant) => teamIds.includes(participant.team.id))
                .map((participant) => participant.team.name);
              const latestCheckin = match.checkins[0];
              return (
                <Card key={match.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          {match.teamAName} vs {match.teamBName}
                        </CardTitle>
                        <CardDescription>
                          {match.organization.name} / {match.publicCode}
                        </CardDescription>
                      </div>
                      <StatusBadge status={match.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {myTeams.map((team) => (
                        <Badge key={team} variant="secondary">
                          {team}
                        </Badge>
                      ))}
                      {latestCheckin ? (
                        <Badge>Checked in {fmt(latestCheckin.createdAt)}</Badge>
                      ) : (
                        <Badge variant="outline">Not checked in</Badge>
                      )}
                    </div>
                    {canCheckIn(match.status) ? (
                      <form
                        action={submitPlayerCheckin}
                        className="grid gap-2 sm:grid-cols-[1fr_auto]"
                      >
                        <input
                          type="hidden"
                          name="matchCode"
                          value={match.publicCode}
                        />
                        <Input
                          name="gameAccount"
                          placeholder="Game account / in-game name"
                          maxLength={120}
                          required
                        />
                        <Button type="submit">Check in</Button>
                      </form>
                    ) : null}
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/matches/${match.publicCode}`}>Open match</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Teams</h2>
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
                <NativeSelect
                  name="organizationId"
                  className="h-8"
                >
                  {memberships.map((membership) => (
                    <option key={membership.id} value={membership.organization.id}>
                      {membership.organization.name}
                    </option>
                  ))}
                </NativeSelect>
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
                  {team.captainProfileId === profile.id ? (
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
                      <Button type="submit" className="w-full" variant="outline">
                        Add teammate
                      </Button>
                    </form>
                  ) : null}
                  {team.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border p-2 text-sm"
                    >
                      <span>{member.displayName}</span>
                      <div className="flex items-center gap-1">
                        {member.userProfile?.discordUserId ? (
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/profiles/${member.userProfile.discordUserId}?from=player`}>
                              Profile
                            </Link>
                          </Button>
                        ) : null}
                        {team.captainProfileId === profile.id &&
                        member.userProfileId !== profile.id ? (
                          <form action={removeTeamMember}>
                            <input type="hidden" name="memberId" value={member.id} />
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
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Recent check-ins</h2>
        <Card>
          <CardContent className="space-y-2 py-4">
            {recentCheckins.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No check-ins submitted yet.
              </p>
            ) : (
              recentCheckins.map((checkin) => (
                <div
                  key={checkin.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {checkin.match.teamAName} vs {checkin.match.teamBName}
                    </p>
                    <p className="text-muted-foreground">
                      {checkin.gameAccount} / {fmt(checkin.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={checkin.match.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
