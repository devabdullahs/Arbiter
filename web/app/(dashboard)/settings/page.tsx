import Link from "next/link";
import { Eye } from "lucide-react";

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

import { ProfileSettingsForm } from "./profile-settings-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  const params = searchParams ? await searchParams : {};

  const discordId = await getLinkedDiscordId(session.user.id);
  const profile = discordId
    ? await prisma.userProfile.findUnique({
        where: { discordUserId: discordId },
        select: {
          displayName: true,
          countryCode: true,
          bio: true,
          profileVisibility: true,
          openToWork: true,
          avatarUrl: true,
          contactEmail: true,
          showContactEmail: true,
          socialLinks: true,
          gameExperiences: true,
          fieldRoles: true,
          updatedAt: true,
        },
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Keep your referee profile accurate so assignments and handoffs are faster."
        actions={
          discordId ? (
            <Button asChild variant="outline">
              <Link href={`/profiles/${discordId}?from=settings`}>
                <Eye />
                Preview profile
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/security">
                <Eye />
                Link Discord to preview
              </Link>
            </Button>
          )
        }
      />
      {params.saved ? (
        <Badge variant="secondary" className="w-fit">
          Profile saved
        </Badge>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referee profile</CardTitle>
          <CardDescription>
            Your name, country, game experience, and field role are global to
            your Arbiter account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileSettingsForm
            key={profile?.updatedAt.toISOString() ?? discordId ?? session.user.id}
            profile={{
              displayName:
                profile?.displayName ?? session.user.name ?? session.user.email ?? "",
              countryCode: profile?.countryCode ?? "",
              bio: profile?.bio ?? "",
              profileVisibility: profile?.profileVisibility ?? "private",
              openToWork: profile?.openToWork ?? false,
              avatarUrl: profile?.avatarUrl ?? session.user.image ?? null,
              contactEmail: profile?.contactEmail ?? session.user.email ?? "",
              showContactEmail: profile?.showContactEmail ?? false,
              socialLinks: profile?.socialLinks,
              gameExperiences: profile?.gameExperiences ?? [],
              fieldRoles: profile?.fieldRoles ?? [],
              discordId,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
