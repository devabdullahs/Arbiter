import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
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
import { NativeSelect } from "@/components/ui/native-select";
import { getAccessContext } from "@/lib/auth-session";
import { OrgMemberRole } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

import { FIELD_ROLE_OPTIONS, GAME_OPTIONS } from "../settings/options";
import { removeOrgMember, updateOrgMemberRole } from "./actions";

function roleRank(role: OrgMemberRole) {
  return {
    [OrgMemberRole.OWNER]: 0,
    [OrgMemberRole.ADMIN]: 1,
    [OrgMemberRole.REFEREE]: 2,
    [OrgMemberRole.PLAYER]: 3,
  }[role];
}

export default async function WorkersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAccessContext();
  if (!ctx) return null;

  if (ctx.orgIds.length === 0 || !ctx.activeOrg) {
    return (
      <div className="space-y-6">
        <PageHeader title="Workers" />
        <NoOrgAccess discordId={ctx.discordId} />
      </div>
    );
  }

  const viewer = ctx.discordId
    ? await prisma.userProfile.findUnique({
        where: { discordUserId: ctx.discordId },
        select: { id: true },
      })
    : null;
  const params = await searchParams;
  const game = typeof params.game === "string" ? params.game : "";
  const role = typeof params.role === "string" ? params.role : "";
  const country =
    typeof params.country === "string" ? params.country.toUpperCase() : "";
  const canDiscover =
    ctx.activeOrg.role === OrgMemberRole.OWNER ||
    ctx.activeOrg.role === OrgMemberRole.ADMIN;
  const canManageMembers = canDiscover;
  const canPromoteOwner = ctx.activeOrg.role === OrgMemberRole.OWNER;

  const [orgMembers, discoveredWorkers, savedWorkers] = await Promise.all([
    prisma.orgMember.findMany({
      where: { organizationId: ctx.activeOrg.id },
      include: { userProfile: true },
      orderBy: { userProfile: { displayName: "asc" } },
    }),
    canDiscover
      ? prisma.userProfile.findMany({
          where: {
            OR: [{ openToWork: true }, { profileVisibility: "public" }],
            memberships: { none: { organizationId: ctx.activeOrg.id } },
            ...(game ? { gameExperiences: { has: game } } : {}),
            ...(role ? { fieldRoles: { has: role } } : {}),
            ...(country ? { countryCode: country } : {}),
          },
          include: {
            savedByProfiles: {
              where: { ownerId: viewer?.id ?? "__none__" },
              select: { priority: true },
            },
          },
          orderBy: [{ openToWork: "desc" }, { updatedAt: "desc" }],
          take: 100,
        })
      : [],
    viewer
      ? prisma.workerFavorite.findMany({
          where: { ownerId: viewer.id },
          orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
          take: 12,
          include: { worker: true },
        })
      : [],
  ]);

  const sortedOrgMembers = [...orgMembers].sort(
    (a, b) =>
      roleRank(a.role) - roleRank(b.role) ||
      (a.userProfile.displayName ?? a.userProfile.discordUserId).localeCompare(
        b.userProfile.displayName ?? b.userProfile.discordUserId,
      ),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers"
        description={`People currently connected to ${ctx.activeOrg.name}. Discovery is separate so operations stays clean.`}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Current organization</h2>
          <Badge variant="outline">{sortedOrgMembers.length} people</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedOrgMembers.map((member) => (
            <Card key={member.id}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="bg-muted flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                    {member.userProfile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.userProfile.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-semibold">
                        {(
                          member.userProfile.displayName?.[0] ??
                          member.userProfile.discordUserId[0] ??
                          "A"
                        ).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {member.userProfile.displayName ??
                        member.userProfile.discordUserId}
                    </CardTitle>
                    <CardDescription>
                      {member.userProfile.countryCode ?? "No country"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge>{member.role.toLowerCase()}</Badge>
                  {member.userProfile.openToWork ? (
                    <Badge variant="secondary">Open to work</Badge>
                  ) : null}
                  {member.userProfile.gameExperiences.slice(0, 3).map((item) => (
                    <Badge key={item} variant="outline">
                      {item}
                    </Badge>
                  ))}
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/profiles/${member.userProfile.discordUserId}?from=workers`}>
                    Open profile
                  </Link>
                </Button>
                {canManageMembers ? (
                  <div className="space-y-2 rounded-lg border p-3">
                    <form
                      action={updateOrgMemberRole}
                      className="grid gap-2 sm:grid-cols-[1fr_auto]"
                    >
                      <input type="hidden" name="memberId" value={member.id} />
                      <NativeSelect
                        name="role"
                        defaultValue={member.role}
                        className="h-8"
                        disabled={member.userProfileId === viewer?.id}
                      >
                        {canPromoteOwner ? (
                          <option value={OrgMemberRole.OWNER}>Owner</option>
                        ) : null}
                        <option value={OrgMemberRole.ADMIN}>Admin</option>
                        <option value={OrgMemberRole.REFEREE}>Referee</option>
                        <option value={OrgMemberRole.PLAYER}>Player</option>
                      </NativeSelect>
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={member.userProfileId === viewer?.id}
                      >
                        Change role
                      </Button>
                    </form>
                    <form action={removeOrgMember}>
                      <input type="hidden" name="memberId" value={member.id} />
                      <ConfirmSubmitButton
                        type="submit"
                        variant="destructive"
                        className="w-full"
                        disabled={member.userProfileId === viewer?.id}
                        confirmMessage={`Remove ${
                          member.userProfile.displayName ??
                          member.userProfile.discordUserId
                        } from this organization?`}
                      >
                        Remove from org
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {savedWorkers.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Saved external workers</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {savedWorkers.map((saved) => (
              <Card key={saved.id}>
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {saved.worker.displayName ?? saved.worker.discordUserId}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {saved.note ?? "No note"}
                      </p>
                    </div>
                    {saved.priority ? (
                      <Badge>Priority</Badge>
                    ) : (
                      <Badge variant="outline">Saved</Badge>
                    )}
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/profiles/${saved.worker.discordUserId}?from=workers`}>
                      Open profile
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Discover workers</h2>
          <p className="text-muted-foreground text-sm">
            Find public or open-to-work profiles that are not already in this
            organization.
          </p>
        </div>

        {!canDiscover ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Discovery is available to organization owners and admins.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent className="py-4">
                <form className="grid gap-3 md:grid-cols-4">
                  <NativeSelect
                    name="game"
                    defaultValue={game}
                  >
                    <option value="">All games</option>
                    {GAME_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    name="role"
                    defaultValue={role}
                  >
                    <option value="">All roles</option>
                    {FIELD_ROLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </NativeSelect>
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
              {discoveredWorkers.length === 0 ? (
                <Card>
                  <CardContent className="text-muted-foreground py-8 text-center text-sm">
                    No matching external workers found.
                  </CardContent>
                </Card>
              ) : (
                discoveredWorkers.map((worker) => (
                  <Card key={worker.id}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className="bg-muted flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                          {worker.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={worker.avatarUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
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
                            {worker.countryCode ?? "No country"}
                            {worker.openToWork ? " / open to work" : ""}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-muted-foreground line-clamp-3 text-sm">
                        {worker.bio ?? "No bio added."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {worker.savedByProfiles[0] ? (
                          <Badge
                            variant={
                              worker.savedByProfiles[0].priority
                                ? "default"
                                : "outline"
                            }
                          >
                            {worker.savedByProfiles[0].priority
                              ? "Priority"
                              : "Saved"}
                          </Badge>
                        ) : null}
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
                        <Link href={`/profiles/${worker.discordUserId}?from=workers`}>
                          Open profile
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
