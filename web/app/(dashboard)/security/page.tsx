import { Laptop, Mail } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard-ui";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { LinkDiscordButton } from "@/components/link-discord";
import { getLinkedDiscordId, getSession } from "@/lib/auth-session";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { prisma } from "@/lib/prisma";

import { revokeOtherSessions, revokeSession, unlinkDiscordAccount } from "./actions";
import { PasskeyManager } from "./passkey-manager";

// Best-effort, dependency-free user-agent summary for the device list.
function describeDevice(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  const browser = /Edg/.test(userAgent)
    ? "Edge"
    : /OPR|Opera/.test(userAgent)
      ? "Opera"
      : /Chrome|CriOS/.test(userAgent)
        ? "Chrome"
        : /Firefox|FxiOS/.test(userAgent)
          ? "Firefox"
          : /Safari/.test(userAgent)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(userAgent)
      ? "iOS"
      : /Mac OS X|Macintosh/.test(userAgent)
        ? "macOS"
        : /Android/.test(userAgent)
          ? "Android"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

export default async function SecurityPage() {
  const session = await getSession();
  if (!session) return null;

  const currentSessionId = session.session.id;
  const [discordId, account, passkeys, sessions] = await Promise.all([
    getLinkedDiscordId(session.user.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, createdAt: true },
    }),
    prisma.passkey.findMany({
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
    }),
    prisma.session.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Login & Security"
        description="Manage how you sign in and where your account is active."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>
            The email and sign-in identity for this dashboard account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            <Mail className="text-muted-foreground size-4" />
            {account?.email ?? session.user.email ?? "No email on file"}
          </span>
          {account?.createdAt ? (
            <span className="text-muted-foreground">
              Member since {formatDate(account.createdAt)}
            </span>
          ) : null}
        </CardContent>
      </Card>

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
              createdAt: passkey.createdAt ? formatDate(passkey.createdAt) : null,
              lastUsedAt: passkey.lastUsedAt
                ? formatDateTime(passkey.lastUsedAt)
                : null,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Signed-in devices</CardTitle>
              <CardDescription>
                Where your account is currently signed in. Revoke anything you
                don&apos;t recognize.
              </CardDescription>
            </div>
            {sessions.length > 1 ? (
              <form action={revokeOtherSessions}>
                <ConfirmSubmitButton
                  type="submit"
                  variant="outline"
                  size="sm"
                  confirmMessage="Sign out of every other device? They will need to sign in again."
                >
                  Sign out other devices
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.map((entry) => {
            const current = entry.id === currentSessionId;
            return (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Laptop className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {describeDevice(entry.userAgent)}
                      {current ? (
                        <Badge variant="secondary" className="h-5">
                          This device
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {entry.ipAddress ? `${entry.ipAddress} · ` : ""}
                      Signed in {formatDateTime(entry.createdAt)} · Last active{" "}
                      {formatDateTime(entry.updatedAt)}
                    </p>
                  </div>
                </div>
                {current ? (
                  <Badge variant="outline">Active now</Badge>
                ) : (
                  <form action={revokeSession}>
                    <input type="hidden" name="id" value={entry.id} />
                    <ConfirmSubmitButton
                      type="submit"
                      variant="ghost"
                      size="sm"
                      confirmMessage="Sign this device out of your account?"
                    >
                      Revoke
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
