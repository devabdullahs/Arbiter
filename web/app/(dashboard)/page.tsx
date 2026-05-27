import { LinkDiscordButton } from "@/components/link-discord";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAccessibleOrgs, getSession } from "@/lib/auth-session";

export default async function DashboardHome() {
  const session = await getSession();
  if (!session) return null; // The layout redirects; this also narrows types.

  const { discordId, orgs } = await getAccessibleOrgs(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm">
          Organizations you can view as an owner, admin, or referee.
        </p>
      </div>

      {orgs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No organization access yet</CardTitle>
            <CardDescription>
              {discordId
                ? "Your linked Discord account isn't an owner, admin, or referee in any organization the bot manages."
                : "Link your Discord account to unlock the organizations where you're an admin or referee."}
            </CardDescription>
          </CardHeader>
          {!discordId ? (
            <CardContent>
              <LinkDiscordButton />
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <Card key={org.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="truncate text-base">{org.name}</CardTitle>
                  <Badge variant="secondary">{org.role.toLowerCase()}</Badge>
                </div>
                <CardDescription className="truncate">
                  Guild {org.discordGuildId}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  Match &amp; BR data for this org appears in the sections on the
                  left.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
