import Link from "next/link";

import { LinkDiscordButton } from "@/components/link-discord";
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

import { AcceptInviteForm } from "./accept-invite-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSession();
  const invite = await prisma.orgInvite.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });
  const discordId = session ? await getLinkedDiscordId(session.user.id) : null;
  // Server-rendered expiry check; invite acceptance re-validates this in the action.
  // eslint-disable-next-line react-hooks/purity
  const expired = invite ? invite.expiresAt.getTime() < Date.now() : false;

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Organization invite</CardTitle>
          <CardDescription>
            Join an Arbiter organization with your dashboard account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!invite ? (
            <p className="text-destructive text-sm">This invite does not exist.</p>
          ) : expired || invite.status !== "pending" ? (
            <p className="text-destructive text-sm">
              This invite is {expired ? "expired" : invite.status}.
            </p>
          ) : (
            <>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Organization:</span>{" "}
                  {invite.organization.name}
                </p>
                <p>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {invite.email}
                </p>
                <p>
                  <span className="text-muted-foreground">Role:</span>{" "}
                  {invite.role.toLowerCase()}
                </p>
              </div>

              {!session ? (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-sm">
                    Sign in with {invite.email}, then return to this page to
                    accept the invite.
                  </p>
                  <Button asChild>
                    <Link href={`/login?callbackURL=/invite/${token}`}>
                      Sign in
                    </Link>
                  </Button>
                </div>
              ) : session.user.email.toLowerCase() !== invite.email.toLowerCase() ? (
                <p className="text-destructive text-sm">
                  You are signed in as {session.user.email}. This invite was sent
                  to {invite.email}.
                </p>
              ) : !discordId ? (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-sm">
                    Link your Discord account before accepting. Arbiter uses your
                    Discord identity for org permissions.
                  </p>
                  <LinkDiscordButton callbackURL={`/invite/${token}`} />
                </div>
              ) : (
                <AcceptInviteForm token={token} />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
