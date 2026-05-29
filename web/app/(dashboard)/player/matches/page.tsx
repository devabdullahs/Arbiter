import Link from "next/link";
import { Swords } from "lucide-react";

import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard-ui";
import { OpenMatchByCode } from "@/components/open-match-by-code";
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
import { MatchStatus } from "@/lib/generated/prisma";
import { formatDate } from "@/lib/format-date";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/web-authz";

import { submitPlayerCheckin } from "../actions";

function canCheckIn(status: MatchStatus) {
  return (
    status === MatchStatus.PENDING ||
    status === MatchStatus.VETO ||
    status === MatchStatus.LIVE
  );
}

export default async function PlayerMatchesPage() {
  const { profile } = await requireUserProfile();
  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { captainProfileId: profile.id },
        { members: { some: { userProfileId: profile.id } } },
      ],
    },
    select: { id: true },
  });
  const teamIds = teams.map((team) => team.id);
  const matches = teamIds.length
    ? await prisma.match.findMany({
        where: { participants: { some: { teamId: { in: teamIds } } } },
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
        take: 80,
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Matches"
        description="Matches linked to teams where you are a player, coach, manager, or team leader."
        actions={<OpenMatchByCode />}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {matches.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState
              icon={Swords}
              title="No matches yet"
              description="Matches linked to teams where you play, coach, or manage will appear here."
            />
          </div>
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
                      <Badge>Checked in {formatDate(latestCheckin.createdAt)}</Badge>
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
                      <PendingSubmitButton pendingChildren="Checking in...">
                        Check in
                      </PendingSubmitButton>
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
    </div>
  );
}
