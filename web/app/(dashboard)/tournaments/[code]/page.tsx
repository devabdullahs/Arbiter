import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";

import { PageHeader } from "@/components/dashboard-ui";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { getAccessContext } from "@/lib/auth-session";
import { OrgMemberRole } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

import {
  addTournamentEntry,
  generateTournamentBracket,
  removeTournamentEntry,
  resetTournamentBracket,
  syncTournamentBracket,
  updateTournamentRefereeSettings,
} from "../actions";
import { BracketView, type BracketNodeView } from "./bracket-view";

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: "Single elimination",
  double_elimination: "Double elimination",
  round_robin: "Round robin",
};

const REFEREE_SETTINGS_ROLES = new Set<OrgMemberRole>([
  OrgMemberRole.OWNER,
  OrgMemberRole.ADMIN,
  OrgMemberRole.MANAGER,
  OrgMemberRole.HEAD_REF,
]);

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const ctx = await getAccessContext();
  if (!ctx) return null;

  const tournament = await prisma.tournament.findFirst({
    where: {
      publicCode: code.toUpperCase(),
      organizationId: { in: ctx.orgIds },
    },
    include: {
      organization: { select: { name: true } },
      entries: { orderBy: { seed: "asc" } },
      bracketNodes: {
        include: { match: { select: { publicCode: true } } },
        orderBy: [{ roundIndex: "asc" }, { slotIndex: "asc" }],
      },
    },
  });
  if (!tournament) notFound();

  const canManage = ctx.orgIds.includes(tournament.organizationId);
  const activeOrgRole =
    ctx.orgs.find((org) => org.id === tournament.organizationId)?.role ?? null;
  const canManageRefSettings = Boolean(
    activeOrgRole && REFEREE_SETTINGS_ROLES.has(activeOrgRole),
  );
  const isDraft = tournament.status === "draft";

  const teams = isDraft
    ? await prisma.team.findMany({
        where: { organizationId: tournament.organizationId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];
  const enteredTeamIds = new Set(
    tournament.entries.map((entry) => entry.teamId).filter(Boolean) as string[],
  );
  const availableTeams = teams.filter((team) => !enteredTeamIds.has(team.id));

  const nodes: BracketNodeView[] = tournament.bracketNodes.map((node) => ({
    id: node.id,
    bracket: node.bracket,
    roundIndex: node.roundIndex,
    slotIndex: node.slotIndex,
    label: node.label,
    teamAName: node.teamAName,
    teamBName: node.teamBName,
    teamASource: node.teamASource,
    teamBSource: node.teamBSource,
    teamAScore: node.teamAScore,
    teamBScore: node.teamBScore,
    teamAResult: node.teamAResult,
    teamBResult: node.teamBResult,
    winnerSlot: node.winnerSlot,
    status: node.status,
    matchCode: node.match?.publicCode ?? null,
  }));

  const addEntry = addTournamentEntry.bind(null, tournament.id);
  const generate = generateTournamentBracket.bind(null, tournament.id);
  const reset = resetTournamentBracket.bind(null, tournament.id);
  const syncBracket = syncTournamentBracket.bind(null, tournament.id);
  const updateRefSettings = updateTournamentRefereeSettings.bind(null, tournament.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={tournament.name}
        description={`${tournament.organization.name} / ${
          FORMAT_LABELS[tournament.format] ?? tournament.format
        } / Best of ${tournament.bestOf}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">{tournament.publicCode}</Badge>
        <Badge variant={tournament.status === "active" ? "default" : "secondary"}>
          {tournament.status}
        </Badge>
        {tournament.gameTitle ? <Badge variant="outline">{tournament.gameTitle}</Badge> : null}
        <Link href="/tournaments" className="text-muted-foreground ml-auto text-sm hover:underline">
          ← All tournaments
        </Link>
      </div>

      {tournament.championName ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <span className="flex size-9 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <Trophy className="size-5" />
            </span>
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Champion
              </p>
              <p className="font-semibold">{tournament.championName}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">Referee claiming</h2>
              <p className="text-muted-foreground text-sm">
                Default assignment behavior for bracket matches opened from this
                tournament. Individual matches can still override it.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{tournament.refereeClaimMode}</Badge>
              <Badge variant="outline">
                {tournament.refereeClaimLimit} ref slot
                {tournament.refereeClaimLimit === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>
          {canManageRefSettings ? (
            <form
              action={updateRefSettings}
              className="grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_auto]"
            >
              <NativeSelect
                name="refereeClaimMode"
                defaultValue={tournament.refereeClaimMode}
                className="h-9"
              >
                <option value="open">Open for eligible refs</option>
                <option value="assigned">Manual assignment only</option>
              </NativeSelect>
              <Input
                name="refereeClaimLimit"
                type="number"
                min={1}
                max={12}
                defaultValue={tournament.refereeClaimLimit}
                className="h-9"
                aria-label="Referee claim limit"
              />
              <PendingSubmitButton variant="outline" pendingChildren="Saving...">
                Save default
              </PendingSubmitButton>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {isDraft ? (
        <Card>
          <CardContent className="space-y-4 py-4">
            <div>
              <h2 className="text-sm font-medium">Seeded teams</h2>
              <p className="text-muted-foreground text-sm">
                Add teams in seed order (seed 1 is the top seed). Generate the
                bracket when everyone is entered.
              </p>
            </div>

            {tournament.entries.length ? (
              <ol className="space-y-2">
                {tournament.entries.map((entry) => {
                  const removeEntry = removeTournamentEntry.bind(null, entry.id);
                  return (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="text-muted-foreground mr-2 tabular-nums">
                          #{entry.seed}
                        </span>
                        <span className="font-medium">{entry.teamName}</span>
                        {entry.teamId ? null : (
                          <Badge variant="outline" className="ml-2 h-4 px-1 text-[10px]">
                            custom
                          </Badge>
                        )}
                      </span>
                      {canManage ? (
                        <form action={removeEntry}>
                          <ConfirmSubmitButton
                            variant="ghost"
                            size="sm"
                            confirmMessage={`Remove ${entry.teamName} from the seeding?`}
                          >
                            Remove
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                No teams entered yet.
              </p>
            )}

            {canManage ? (
              <form action={addEntry} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <NativeSelect name="teamId" defaultValue="" className="h-9">
                  <option value="">Custom team name…</option>
                  {availableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </NativeSelect>
                <Input name="teamName" placeholder="Custom name (if no team picked)" maxLength={120} className="h-9" />
                <PendingSubmitButton variant="outline" pendingChildren="Adding...">
                  Add team
                </PendingSubmitButton>
              </form>
            ) : null}

            {canManage ? (
              <div className="flex items-center justify-between border-t pt-4">
                <p className="text-muted-foreground text-xs">
                  {tournament.entries.length < 2
                    ? "Add at least 2 teams to generate the bracket."
                    : `${tournament.entries.length} teams ready.`}
                </p>
                {tournament.entries.length >= 2 ? (
                  <form action={generate}>
                    <ConfirmSubmitButton
                      confirmTitle="Generate bracket?"
                      confirmMessage="This locks the seeding and creates all matches. You can reset later to edit teams."
                      confirmActionLabel="Generate"
                    >
                      Generate bracket
                    </ConfirmSubmitButton>
                  </form>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">Bracket</h2>
              {canManage ? (
                <div className="flex items-center gap-2">
                  <form action={syncBracket}>
                    <PendingSubmitButton
                      variant="outline"
                      size="sm"
                      pendingChildren="Syncing..."
                    >
                      Sync bracket flow
                    </PendingSubmitButton>
                  </form>
                  <form action={reset}>
                    <ConfirmSubmitButton
                      variant="outline"
                      size="sm"
                      confirmTitle="Reset bracket?"
                      confirmMessage="This deletes all bracket matches and results, returning the tournament to draft so you can re-seed."
                      confirmActionLabel="Reset"
                    >
                      Reset bracket
                    </ConfirmSubmitButton>
                  </form>
                </div>
              ) : null}
            </div>
            <BracketView nodes={nodes} format={tournament.format} canManage={canManage} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
