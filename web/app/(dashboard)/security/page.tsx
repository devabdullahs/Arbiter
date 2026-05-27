import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard-ui";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { LinkDiscordButton } from "@/components/link-discord";
import { getLinkedDiscordId, getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

import { unlinkDiscordAccount } from "./actions";
import { PasskeyManager } from "./passkey-manager";

export default async function SecurityPage() {
  const session = await getSession();
  if (!session) return null;

  const discordId = await getLinkedDiscordId(session.user.id);
  const passkeys = await prisma.passkey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      deviceType: true,
      backedUp: true,
      transports: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Login & Security"
        description="Manage passkeys for your dashboard account."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected accounts</CardTitle>
          <CardDescription>
            Discord linking controls which Arbiter organizations and referee
            permissions this dashboard account can access.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Discord</p>
            <p className="text-muted-foreground text-sm">
              {discordId ? `Connected as ${discordId}` : "Not connected"}
            </p>
          </div>
          {discordId ? (
            <form action={unlinkDiscordAccount}>
              <ConfirmSubmitButton
                type="submit"
                variant="outline"
                confirmMessage="Disconnect Discord from this dashboard account? You may lose organization access until you reconnect."
              >
                Disconnect Discord
              </ConfirmSubmitButton>
            </form>
          ) : (
            <LinkDiscordButton callbackURL="/security" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Passkeys</CardTitle>
          <CardDescription>
            Name passkeys clearly, remove old devices, and keep at least one
            recovery sign-in method available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasskeyManager
            passkeys={passkeys.map((passkey) => ({
              ...passkey,
              createdAt: passkey.createdAt
                ? passkey.createdAt.toLocaleDateString()
                : null,
              lastUsedAt: passkey.lastUsedAt
                ? passkey.lastUsedAt.toLocaleString()
                : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
