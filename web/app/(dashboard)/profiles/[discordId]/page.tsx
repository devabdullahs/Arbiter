import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AtSign,
  ArrowLeft,
  BriefcaseBusiness,
  Camera,
  Mail,
  MessageCircle,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard-ui";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  if (linkedin) {
    links.push({
      href: `https://www.linkedin.com/in/${linkedin}`,
      Icon: BriefcaseBusiness,
      label: "LinkedIn",
    });
  }
  if (x) {
    links.push({ href: `https://x.com/${x}`, Icon: AtSign, label: "X" });
  }
  if (instagram) {
    links.push({
      href: `https://www.instagram.com/${instagram}`,
      Icon: Camera,
      label: "Instagram",
    });
  }
  if (discord) {
    links.push({
      href: `https://discord.com/users/${discordUserId}`,
      Icon: MessageCircle,
      label: "Discord",
    });
  }
  return links;
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ discordId: string }>;
  searchParams?: Promise<{ from?: string }>;
}) {
  const { discordId } = await params;
  const { from } = searchParams ? await searchParams : {};
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
  const hasContactMethods =
    Boolean(profile.showContactEmail && profile.contactEmail) || links.length > 0;
  const backTarget = isSelf
    ? { href: "/settings", label: "Back to Profile" }
    : from === "player"
      ? { href: "/player", label: "Back to Player" }
      : { href: "/workers", label: "Back to Workers" };

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
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={backTarget.href}>
              <ArrowLeft />
              {backTarget.label}
            </Link>
          </Button>
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
      </div>

      {!isSelf ? (
        <Card>
          <CardContent className="py-4">
            <form action={saveAction} className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <Input
                name="note"
                defaultValue={saved?.note ?? ""}
                placeholder="Private note for your worker list"
                maxLength={300}
                className="h-9"
              />
              <Field
                orientation="horizontal"
                className="h-9 rounded-lg border px-3"
              >
                <Checkbox
                  id="save-worker-priority"
                  name="priority"
                  defaultChecked={saved?.priority ?? false}
                />
                <FieldLabel htmlFor="save-worker-priority">
                  Priority
                </FieldLabel>
              </Field>
              <PendingSubmitButton pendingChildren="Saving...">
                {saved ? "Update saved" : "Save worker"}
              </PendingSubmitButton>
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
              <PendingSubmitButton pendingChildren="Sending...">
                {request?.status === "pending" ? "Request sent" : "Request access"}
              </PendingSubmitButton>
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
              <section className="grid gap-2">
                <h3 className="text-sm font-medium">Bio</h3>
                <p className="text-sm">{profile.bio || "No bio added yet."}</p>
              </section>

              <div className="grid gap-4 md:grid-cols-3">
                <section className="grid gap-2 rounded-lg border p-3">
                  <h3 className="text-sm font-medium">Country</h3>
                  <div>
                    {profile.countryCode ? (
                      <Badge variant="outline">{profile.countryCode}</Badge>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No country added.
                      </p>
                    )}
                  </div>
                </section>

                <section className="grid gap-2 rounded-lg border p-3">
                  <h3 className="text-sm font-medium">Games</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.gameExperiences.length ? (
                      profile.gameExperiences.map((game) => (
                        <Badge key={game} variant="secondary">
                          {game}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No games added.
                      </p>
                    )}
                  </div>
                </section>

                <section className="grid gap-2 rounded-lg border p-3">
                  <h3 className="text-sm font-medium">Field roles</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.fieldRoles.length ? (
                      profile.fieldRoles.map((role) => (
                        <Badge key={role} variant="outline">
                          {role}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No field roles added.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              {hasContactMethods ? (
                <section className="grid gap-3 rounded-lg border p-3">
                  <FieldContent>
                    <FieldTitle>Contact & socials</FieldTitle>
                    <FieldDescription>
                      Public contact methods this profile has chosen to show.
                    </FieldDescription>
                  </FieldContent>
                  <div className="flex flex-wrap gap-2">
                    {profile.showContactEmail && profile.contactEmail ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={`mailto:${profile.contactEmail}`}>
                          <Mail />
                          {profile.contactEmail}
                        </a>
                      </Button>
                    ) : null}
                    {links.map(({ href, Icon, label }) => (
                      <Button key={label} asChild variant="outline" size="sm">
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          <Icon />
                          {label}
                        </a>
                      </Button>
                    ))}
                  </div>
                </section>
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
