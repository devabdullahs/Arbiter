import { PageHeader } from "@/components/dashboard-ui";
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

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

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
        },
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Keep your referee profile accurate so assignments and handoffs are faster."
      />

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
