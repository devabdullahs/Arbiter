import Link from "next/link";

import { PageHeader, StatusBadge } from "@/components/dashboard-ui";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format-date";
import { prisma } from "@/lib/prisma";
import { requireUserProfile } from "@/lib/web-authz";

import { submitPlayerCheckin } from "../actions";

export default async function PlayerCheckinsPage() {
  const { profile } = await requireUserProfile();
  const checkins = await prisma.checkin.findMany({
    where: { userProfileId: profile.id },
    include: {
      match: {
        select: {
          publicCode: true,
          teamAName: true,
          teamBName: true,
          status: true,
          organization: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-ins"
        description="Submit a match code check-in quickly, then keep your recent receipts in one place."
      />

      <Card>
        <CardContent className="py-4">
          <form
            action={submitPlayerCheckin}
            className="grid gap-3 md:grid-cols-[180px_1fr_auto]"
          >
            <Input
              name="matchCode"
              placeholder="Match code"
              maxLength={16}
              required
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 py-4">
          {checkins.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No check-ins submitted yet.
            </p>
          ) : (
            checkins.map((checkin) => (
              <div
                key={checkin.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {checkin.match.teamAName} vs {checkin.match.teamBName}
                  </p>
                  <p className="text-muted-foreground">
                    {checkin.match.organization.name} / {checkin.gameAccount} /{" "}
                    {formatDateTime(checkin.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={checkin.match.status} />
                  <Badge variant="outline">{checkin.match.publicCode}</Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/matches/${checkin.match.publicCode}`}>
                      Open
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
