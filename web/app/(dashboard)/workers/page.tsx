import Link from "next/link";

import { NoOrgAccess, PageHeader } from "@/components/dashboard-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAccessContext } from "@/lib/auth-session";
import { OrgMemberRole } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

import { FIELD_ROLE_OPTIONS, GAME_OPTIONS } from "../settings/options";

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  if (ctx.orgIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Workers" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const managerOrgs = ctx.orgs.filter(
    (org) => org.role === OrgMemberRole.OWNER || org.role === OrgMemberRole.ADMIN,
  );
  const params = await searchParams;
  const game = typeof params.game === "string" ? params.game : "";
  const role = typeof params.role === "string" ? params.role : "";
  const country = typeof params.country === "string" ? params.country.toUpperCase() : "";

  if (managerOrgs.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Workers"
          description="Worker discovery is available to organization owners and admins."
        />
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            You need owner or admin access to browse open worker profiles.
          </CardContent>
        </Card>
      </div>
    );
  }

  const workers = await prisma.userProfile.findMany({
    where: {
      OR: [{ openToWork: true }, { profileVisibility: "public" }],
      ...(game ? { gameExperiences: { has: game } } : {}),
      ...(role ? { fieldRoles: { has: role } } : {}),
      ...(country ? { countryCode: country } : {}),
    },
    orderBy: [{ openToWork: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers"
        description="Find public or open-to-work referees, admins, and event staff."
      />

      <Card>
        <CardContent className="py-4">
          <form className="grid gap-3 md:grid-cols-4">
            <select
              name="game"
              defaultValue={game}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            >
              <option value="">All games</option>
              {GAME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              name="role"
              defaultValue={role}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            >
              <option value="">All roles</option>
              {FIELD_ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              name="country"
              defaultValue={country}
              placeholder="Country code"
              maxLength={2}
              className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
            />
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {workers.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              No matching workers found.
            </CardContent>
          </Card>
        ) : (
          workers.map((worker) => (
            <Card key={worker.id}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="bg-muted flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                    {worker.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={worker.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-semibold">
                        {(worker.displayName?.[0] ?? "A").toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {worker.displayName ?? worker.discordUserId}
                    </CardTitle>
                    <CardDescription>
                      {worker.countryCode ?? "No country"}{" "}
                      {worker.openToWork ? "/ open to work" : ""}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground line-clamp-3 text-sm">
                  {worker.bio ?? "No bio added."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {worker.gameExperiences.slice(0, 3).map((item) => (
                    <Badge key={item} variant="secondary">
                      {item}
                    </Badge>
                  ))}
                  {worker.fieldRoles.slice(0, 2).map((item) => (
                    <Badge key={item} variant="outline">
                      {item}
                    </Badge>
                  ))}
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/profiles/${worker.discordUserId}`}>Open profile</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
