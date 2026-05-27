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
import { saveWorker } from "./actions";

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

function socialLinks(socialLinksValue: unknown, discordUserId: string) {
  const social =
    socialLinksValue && typeof socialLinksValue === "object"
      ? (socialLinksValue as Record<string, unknown>)
      : {};
  const links = [];
  const linkedin = typeof social.linkedin === "string" ? social.linkedin : "";
  const x = typeof social.x === "string" ? social.x : "";
  const instagram = typeof social.instagram === "string" ? social.instagram : "";
  const discord = typeof social.discord === "string" ? social.discord : "";
  if (linkedin) links.push(["LinkedIn", `https://www.linkedin.com/in/${linkedin}`]);
  if (x) links.push(["X", `https://x.com/${x}`]);
  if (instagram) links.push(["Instagram", `https://www.instagram.com/${instagram}`]);
  if (discord) links.push(["Discord", `https://discord.com/users/${discordUserId}`]);
  return links;
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
      savedByProfiles: {
        where: { ownerId: viewer?.id ?? "__none__" },
        select: { priority: true, note: true },
      },
    },
  });

  if (!profile) notFound();

  const isSelf = viewer?.id === profile.id;
  const request = profile.receivedProfileRequests[0];
  const saved = profile.savedByProfiles[0];
  const visible = canSeeFullProfile({
    isSelf,
    visibility: profile.profileVisibility,
    connected: request?.status === "accepted",
  });
  const requestAction = requestProfileConnection.bind(null, profile.id);
  const saveAction = saveWorker.bind(null, profile.id);
  const links = socialLinks(profile.socialLinks, profile.discordUserId);

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
          {saved ? (
            <Badge variant={saved.priority ? "default" : "secondary"}>
              {saved.priority ? "Priority" : "Saved"}
            </Badge>
          ) : null}
        </div>
      </div>

      {!isSelf ? (
        <Card>
          <CardContent className="py-4">
            <form action={saveAction} className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <input
                name="note"
                defaultValue={saved?.note ?? ""}
                placeholder="Private note for your worker list"
                maxLength={300}
                className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
              />
              <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
                <input type="checkbox" name="priority" defaultChecked={saved?.priority ?? false} />
                Priority
              </label>
              <Button type="submit">{saved ? "Update saved" : "Save worker"}</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

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
              {profile.showContactEmail && profile.contactEmail ? (
                <a
                  href={`mailto:${profile.contactEmail}`}
                  className="text-primary text-sm hover:underline"
                >
                  {profile.contactEmail}
                </a>
              ) : null}
              {links.length ? (
                <div className="flex flex-wrap gap-2">
                  {links.map(([label, href]) => (
                    <Button key={label} asChild variant="outline" size="sm">
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {label}
                      </a>
                    </Button>
                  ))}
                </div>
              ) : null}
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
