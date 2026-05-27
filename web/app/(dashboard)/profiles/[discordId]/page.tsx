import { notFound } from "next/navigation";

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
import { getLinkedDiscordId, getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

import { requestProfileConnection } from "./actions";

function canSeeFullProfile({
  isSelf,
  visibility,
  connected,
}: {
  isSelf: boolean;
  visibility: string;
  connected: boolean;
}) {
  return isSelf || visibility === "public" || (visibility === "connections" && connected);
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ discordId: string }>;
}) {
  const { discordId } = await params;
  const session = await getSession();
  if (!session) return null;

  const viewerDiscordId = await getLinkedDiscordId(session.user.id);
  const viewer = viewerDiscordId
    ? await prisma.userProfile.findUnique({
        where: { discordUserId: viewerDiscordId },
        select: { id: true },
      })
    : null;

  const profile = await prisma.userProfile.findUnique({
    where: { discordUserId: discordId },
    include: {
      memberships: {
        include: { organization: { select: { name: true } } },
      },
      teamMembers: {
        include: { team: { select: { name: true, organization: { select: { name: true } } } } },
        take: 20,
      },
      receivedProfileRequests: {
        where: { requesterId: viewer?.id ?? "__none__" },
        select: { status: true },
      },
    },
  });

  if (!profile) notFound();

  const isSelf = viewer?.id === profile.id;
  const request = profile.receivedProfileRequests[0];
  const visible = canSeeFullProfile({
    isSelf,
    visibility: profile.profileVisibility,
    connected: request?.status === "accepted",
  });
  const requestAction = requestProfileConnection.bind(null, profile.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-muted flex size-20 items-center justify-center overflow-hidden rounded-xl border">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold">
                {(profile.displayName?.[0] ?? "A").toUpperCase()}
              </span>
            )}
          </div>
          <PageHeader
            title={profile.displayName ?? profile.discordUserId}
            description={`Discord ${profile.discordUserId}`}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{profile.profileVisibility}</Badge>
          {profile.openToWork ? <Badge>Open to work</Badge> : null}
        </div>
      </div>

      {!visible ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Private profile</CardTitle>
            <CardDescription>
              This profile is private. Send a connection request to ask for
              access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={requestAction} className="space-y-3">
              <textarea
                name="message"
                rows={3}
                maxLength={300}
                placeholder="Optional message"
                className="border-input bg-background w-full rounded-lg border px-2.5 py-2 text-sm"
              />
              <Button type="submit">
                {request?.status === "pending" ? "Request sent" : "Request access"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{profile.bio || "No bio added yet."}</p>
              <div className="flex flex-wrap gap-2">
                {profile.countryCode ? (
                  <Badge variant="outline">{profile.countryCode}</Badge>
                ) : null}
                {profile.gameExperiences.map((game) => (
                  <Badge key={game} variant="secondary">
                    {game}
                  </Badge>
                ))}
                {profile.fieldRoles.map((role) => (
                  <Badge key={role} variant="outline">
                    {role}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Organizations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {profile.memberships.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No organization history.</p>
                ) : (
                  profile.memberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <span className="font-medium">{membership.organization.name}</span>
                      <Badge variant="outline">{membership.role.toLowerCase()}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Teams</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {profile.teamMembers.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No team membership.</p>
                ) : (
                  profile.teamMembers.map((member) => (
                    <div key={member.id} className="rounded-lg border p-3">
                      <p className="font-medium">{member.team.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {member.team.organization.name}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
