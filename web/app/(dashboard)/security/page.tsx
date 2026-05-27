import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard-ui";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

import { PasskeyManager } from "./passkey-manager";

export default async function SecurityPage() {
  const session = await getSession();
  if (!session) return null;

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
        title="Security"
        description="Manage passkeys for your dashboard account."
      />

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
