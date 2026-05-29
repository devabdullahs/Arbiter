"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { cn } from "@/lib/utils";
import { RESULT_LABEL_OPTIONS, scoreSide } from "@/lib/score-format";

import { openBracketMatch, reportBracketResultWithState } from "../actions";

export type BracketNodeView = {
  id: string;
  bracket: string;
  roundIndex: number;
  slotIndex: number;
  label: string | null;
  teamAName: string | null;
  teamBName: string | null;
  teamASource: string | null;
  teamBSource: string | null;
  teamAScore: number;
  teamBScore: number;
  teamAResult: string | null;
  teamBResult: string | null;
  winnerSlot: string | null;
  status: string;
  matchCode: string | null;
};

type RoundVariant = "se" | "wb" | "lb" | "rr";

function roundLabel(variant: RoundVariant, round: number, lastRound: number) {
  if (variant === "rr") return `Round ${round + 1}`;
  const dist = lastRound - round;
  if (variant === "lb") return dist === 0 ? "LB Final" : `LB Round ${round + 1}`;
  if (variant === "wb") {
    if (dist === 0) return "WB Final";
    if (dist === 1) return "WB Semifinals";
    return `WB Round ${round + 1}`;
  }
  if (dist === 0) return "Final";
  if (dist === 1) return "Semifinals";
  if (dist === 2) return "Quarterfinals";
  return `Round of ${2 ** (dist + 1)}`;
}

function TeamRow({
  name,
  source,
  score,
  result,
  isWinner,
  isChampion,
  showScore,
}: {
  name: string | null;
  source: string | null;
  score: number;
  result: string | null;
  isWinner: boolean;
  isChampion: boolean;
  showScore: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm",
        isWinner
          ? "bg-muted/50 font-semibold"
          : name
            ? ""
            : "text-muted-foreground italic",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {isChampion ? (
          <Trophy className="size-3.5 shrink-0 text-amber-500" />
        ) : null}
        <span className="truncate">{name ?? source ?? "TBD"}</span>
      </span>
      {showScore ? (
        <span className="tabular-nums">{scoreSide(score, result)}</span>
      ) : null}
    </div>
  );
}

function MatchCard({
  node,
  canManage,
  terminalId,
}: {
  node: BracketNodeView;
  canManage: boolean;
  terminalId?: string | null;
}) {
  const decided = node.status === "complete";
  const isBye = node.status === "bye";
  const reportable =
    canManage && !isBye && Boolean(node.teamAName) && Boolean(node.teamBName);
  // The terminal match's winner is the tournament champion. We only crown the
  // final/grand-final node (not every earlier round the winner happened to win).
  const isChampionCard = decided && Boolean(terminalId) && node.id === terminalId;
  const action = reportBracketResultWithState.bind(null, node.id);
  const [state, formAction] = useActionState(action, {});
  const openMatch = openBracketMatch.bind(null, node.id);

  return (
    <div
      className={cn(
        "bg-card w-56 overflow-hidden rounded-lg border",
        isChampionCard
          ? "border-amber-500/50 ring-1 ring-amber-500/20"
          : decided
            ? "border-border"
            : "border-dashed",
      )}
    >
      <div className="bg-muted/40 flex items-center justify-between gap-2 px-2.5 py-1 text-[11px]">
        <span className="text-muted-foreground truncate">{node.label}</span>
        {isChampionCard ? (
          <Badge className="h-4 border-amber-500/40 bg-amber-500/15 px-1 text-[10px] text-amber-600 dark:text-amber-400">
            champion
          </Badge>
        ) : isBye ? (
          <Badge variant="outline" className="h-4 px-1 text-[10px]">bye</Badge>
        ) : decided ? (
          <Badge variant="secondary" className="h-4 px-1 text-[10px]">final</Badge>
        ) : reportable ? (
          <Badge variant="default" className="h-4 px-1 text-[10px]">ready</Badge>
        ) : null}
      </div>
      <TeamRow
        name={node.teamAName}
        source={node.teamASource}
        score={node.teamAScore}
        result={node.teamAResult}
        isWinner={node.winnerSlot === "teamA"}
        isChampion={isChampionCard && node.winnerSlot === "teamA"}
        showScore={decided}
      />
      <div className="bg-border h-px" />
      <TeamRow
        name={node.teamBName}
        source={node.teamBSource}
        score={node.teamBScore}
        result={node.teamBResult}
        isWinner={node.winnerSlot === "teamB"}
        isChampion={isChampionCard && node.winnerSlot === "teamB"}
        showScore={decided}
      />
      {reportable ? (
        <div className="space-y-2 border-t p-2">
          <form action={formAction} className="space-y-2">
            {state.error ? (
              <p className="text-destructive text-[11px]">{state.error}</p>
            ) : null}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
              <div className="flex flex-col gap-1">
                <Input
                  name="teamAScore"
                  type="number"
                  min={0}
                  max={999}
                  defaultValue={decided ? node.teamAScore : 0}
                  aria-label={`${node.teamAName} score`}
                  className="h-7 px-1 text-center"
                />
                <select
                  name="teamAResult"
                  defaultValue={node.teamAResult ?? ""}
                  aria-label={`${node.teamAName} ruling`}
                  className="border-input bg-background h-7 rounded-md border px-1 text-[11px]"
                >
                  {RESULT_LABEL_OPTIONS.map((option) => (
                    <option key={option.value || "numeric"} value={option.value}>
                      {option.value || "-"}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-muted-foreground text-xs">:</span>
              <div className="flex flex-col gap-1">
                <Input
                  name="teamBScore"
                  type="number"
                  min={0}
                  max={999}
                  defaultValue={decided ? node.teamBScore : 0}
                  aria-label={`${node.teamBName} score`}
                  className="h-7 px-1 text-center"
                />
                <select
                  name="teamBResult"
                  defaultValue={node.teamBResult ?? ""}
                  aria-label={`${node.teamBName} ruling`}
                  className="border-input bg-background h-7 rounded-md border px-1 text-[11px]"
                >
                  {RESULT_LABEL_OPTIONS.map((option) => (
                    <option key={option.value || "numeric"} value={option.value}>
                      {option.value || "-"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <PendingSubmitButton size="sm" className="h-7 w-full" pendingChildren="...">
              {decided ? "Correct result" : "Report result"}
            </PendingSubmitButton>
          </form>
          <div>
            {node.matchCode ? (
              <Link
                href={`/matches/${node.matchCode}`}
                className="bg-secondary text-secondary-foreground block rounded-md px-2 py-1.5 text-center text-xs font-medium hover:bg-secondary/80"
              >
                Manage match
              </Link>
            ) : (
              <form action={openMatch}>
                <PendingSubmitButton
                  variant="outline"
                  size="sm"
                  className="h-7 w-full"
                  pendingChildren="Opening..."
                >
                  Open match controls
                </PendingSubmitButton>
              </form>
            )}
          </div>
          {decided ? (
            <p className="text-muted-foreground mt-1 text-[10px]">
              Correction clears affected downstream matches.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Columns({
  nodes,
  canManage,
  variant,
  title,
  terminalId,
  extraLastColumn,
  scroll = true,
}: {
  nodes: BracketNodeView[];
  canManage: boolean;
  variant: RoundVariant;
  title?: string;
  terminalId?: string | null;
  extraLastColumn?: BracketNodeView[];
  scroll?: boolean;
}) {
  if (!nodes.length) return null;
  const rounds = new Map<number, BracketNodeView[]>();
  for (const node of nodes) {
    const list = rounds.get(node.roundIndex) ?? [];
    list.push(node);
    rounds.set(node.roundIndex, list);
  }
  const roundKeys = [...rounds.keys()].sort((a, b) => a - b);
  const lastRound = roundKeys[roundKeys.length - 1];
  const extras = extraLastColumn?.length ? extraLastColumn : null;

  return (
    <div className="space-y-2">
      {title ? <h3 className="text-sm font-medium">{title}</h3> : null}
      <div className={cn("flex gap-6 pb-3", scroll && "overflow-x-auto")}>
        {roundKeys.map((round) => {
          const roundNodes = (rounds.get(round) ?? []).sort(
            (a, b) => a.slotIndex - b.slotIndex,
          );
          return (
            <div key={round} className="flex w-56 shrink-0 flex-col gap-3">
              <p className="text-muted-foreground text-center text-[11px] font-semibold uppercase tracking-wide">
                {roundLabel(variant, round, lastRound)}
              </p>
              <div className="flex flex-1 flex-col justify-around">
                <div className="space-y-4">
                  {roundNodes.map((node) => (
                    <MatchCard
                      key={node.id}
                      node={node}
                      canManage={canManage}
                      terminalId={terminalId}
                    />
                  ))}
                  {round === lastRound && extras ? (
                    <div className="space-y-2 border-t pt-4">
                      <p className="text-muted-foreground text-xs font-medium">
                        Third-place match
                      </p>
                      {extras.map((node) => (
                        <MatchCard
                          key={node.id}
                          node={node}
                          canManage={canManage}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type StandRow = {
  name: string;
  mw: number;
  ml: number;
  md: number;
  gf: number;
  ga: number;
  played: number;
};

// Build round-robin standings from completed fixtures. Series record (mw/ml/md)
// and game record (gf/ga) are derived from per-node scores. Teams are included
// even before they have played so the cross-table shows every participant.
function computeStandings(nodes: BracketNodeView[]): StandRow[] {
  const table = new Map<string, StandRow>();
  const ensure = (name: string) => {
    let row = table.get(name);
    if (!row) {
      row = { name, mw: 0, ml: 0, md: 0, gf: 0, ga: 0, played: 0 };
      table.set(name, row);
    }
    return row;
  };
  for (const node of nodes) {
    if (!node.teamAName || !node.teamBName) continue;
    const a = ensure(node.teamAName);
    const b = ensure(node.teamBName);
    if (node.status !== "complete") continue;
    a.played++;
    b.played++;
    a.gf += node.teamAScore;
    a.ga += node.teamBScore;
    b.gf += node.teamBScore;
    b.ga += node.teamAScore;
    if (node.winnerSlot === "teamA") {
      a.mw++;
      b.ml++;
    } else if (node.winnerSlot === "teamB") {
      b.mw++;
      a.ml++;
    } else {
      a.md++;
      b.md++;
    }
  }
  return [...table.values()].sort(
    (x, y) =>
      y.mw - x.mw ||
      y.gf - y.ga - (x.gf - x.ga) ||
      y.gf - x.gf ||
      x.name.localeCompare(y.name),
  );
}

function teamHue(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

function teamAbbrev(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
}

// Deterministic monogram chip standing in for a team logo (logos aren't in the
// data). Same name always maps to the same colour so it reads consistently.
function TeamMonogram({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        // overflow-hidden keeps the chip a fixed square — without it a wide
        // abbreviation (e.g. "RWW") sets min-width:auto and the chip balloons.
        "flex size-6 shrink-0 items-center justify-center overflow-hidden rounded text-[9px] font-bold leading-none tracking-tight text-white",
        className,
      )}
      style={{ backgroundColor: `hsl(${teamHue(name)} 50% 42%)` }}
      title={name}
    >
      {teamAbbrev(name)}
    </span>
  );
}

function pairKey(a: string, b: string) {
  // Length-prefixed so the key is unambiguous regardless of name contents
  // (a plain separator would make ["A B","C"] and ["A","B C"] collide).
  const [x, y] = [a, b].sort();
  return `${x.length}:${x}|${y.length}:${y}`;
}

function Standings({ rows }: { rows: StandRow[] }) {
  if (!rows.length) return null;
  const last = rows.length - 1;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Standings</h3>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="w-10 px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Team</th>
              <th className="w-20 px-2 py-2 text-center">W–L</th>
              <th className="w-16 px-2 py-2 text-center">Games</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const top = index === 0;
              const bottom = index === last && rows.length > 2;
              return (
                <tr
                  key={row.name}
                  className={cn(
                    "border-t",
                    top ? "bg-emerald-500/5" : bottom ? "bg-red-500/5" : "",
                  )}
                >
                  <td
                    className={cn(
                      "border-l-2 px-3 py-2 tabular-nums",
                      top
                        ? "border-emerald-500/60"
                        : bottom
                          ? "border-red-500/50"
                          : "border-transparent",
                    )}
                  >
                    {index + 1}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <TeamMonogram name={row.name} />
                      <span className="truncate font-medium">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center font-semibold tabular-nums">
                    {row.mw}–{row.ml}
                    {row.md ? `–${row.md}` : ""}
                  </td>
                  <td className="text-muted-foreground px-2 py-2 text-center tabular-nums">
                    {row.gf}–{row.ga}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CrossTable({
  rows,
  nodes,
}: {
  rows: StandRow[];
  nodes: BracketNodeView[];
}) {
  const [showDuplicates, setShowDuplicates] = useState(false);
  if (rows.length < 2) return null;

  const byPair = new Map<string, BracketNodeView>();
  for (const node of nodes) {
    if (node.teamAName && node.teamBName) {
      byPair.set(pairKey(node.teamAName, node.teamBName), node);
    }
  }
  const indexOf = new Map(rows.map((team, index) => [team.name, index] as const));

  // Compact (default): each pairing shown once as a left-aligned lower triangle
  // like Liquipedia — rows are teams 2..N, columns teams 1..(N-1), no filler.
  // "Show duplicates" expands to the full mirrored grid with an empty diagonal.
  const rowTeams = showDuplicates ? rows : rows.slice(1);
  const colTeams = showDuplicates ? rows : rows.slice(0, rows.length - 1);

  function resultCell(rowTeam: StandRow, colTeam: StandRow) {
    const node = byPair.get(pairKey(rowTeam.name, colTeam.name));
    const decided = node?.status === "complete";
    let rowScore = 0;
    let colScore = 0;
    if (node && decided) {
      if (node.teamAName === rowTeam.name) {
        rowScore = node.teamAScore;
        colScore = node.teamBScore;
      } else {
        rowScore = node.teamBScore;
        colScore = node.teamAScore;
      }
    }
    const result =
      decided && rowScore !== colScore
        ? rowScore > colScore
          ? "w"
          : "l"
        : null;
    return (
      <td
        key={colTeam.name}
        className={cn(
          "border-border/70 h-9 min-w-12 border p-1.5 text-center tabular-nums",
          result === "w"
            ? "bg-emerald-500/15 font-medium text-emerald-600 dark:text-emerald-400"
            : result === "l"
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "text-muted-foreground",
        )}
      >
        {decided ? `${rowScore}–${colScore}` : "·"}
      </td>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Head-to-head</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowDuplicates((value) => !value)}
        >
          {showDuplicates ? "Hide duplicates" : "Show duplicates"}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border p-2">
        <table className="border-collapse text-center text-xs">
          <tbody>
            {rowTeams.map((rowTeam) => {
              const ri = indexOf.get(rowTeam.name) ?? 0;
              return (
                <tr key={rowTeam.name}>
                  <th className="py-1 pr-3 text-left font-medium">
                    <div className="flex min-w-0 items-center gap-2">
                      <TeamMonogram name={rowTeam.name} />
                      <span className="hidden truncate sm:inline">
                        {rowTeam.name}
                      </span>
                    </div>
                  </th>
                  {colTeams.map((colTeam) => {
                    const ci = indexOf.get(colTeam.name) ?? 0;
                    if (showDuplicates) {
                      return ri === ci ? (
                        <td
                          key={colTeam.name}
                          className="border-border/70 bg-muted/40 h-9 min-w-12 border"
                          aria-hidden
                        />
                      ) : (
                        resultCell(rowTeam, colTeam)
                      );
                    }
                    return ci < ri ? (
                      resultCell(rowTeam, colTeam)
                    ) : (
                      <td key={colTeam.name} className="min-w-12" aria-hidden />
                    );
                  })}
                </tr>
              );
            })}
            {/* Column identities sit along the bottom, like Liquipedia. */}
            <tr>
              <th aria-hidden />
              {colTeams.map((colTeam) => (
                <th key={colTeam.name} className="pt-2">
                  <div className="flex justify-center">
                    <TeamMonogram name={colTeam.name} />
                  </div>
                </th>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchdayResults({
  nodes,
  canManage,
}: {
  nodes: BracketNodeView[];
  canManage: boolean;
}) {
  const byRound = new Map<number, BracketNodeView[]>();
  for (const node of nodes) {
    const list = byRound.get(node.roundIndex) ?? [];
    list.push(node);
    byRound.set(node.roundIndex, list);
  }
  const roundKeys = [...byRound.keys()].sort((a, b) => a - b);
  if (!roundKeys.length) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Results</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roundKeys.map((round) => {
          const matches = (byRound.get(round) ?? []).sort(
            (a, b) => a.slotIndex - b.slotIndex,
          );
          return (
            <div key={round} className="space-y-3 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Round {round + 1}
              </p>
              <div className="flex flex-col items-start gap-3">
                {matches.map((node) => (
                  <MatchCard key={node.id} node={node} canManage={canManage} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BracketView({
  nodes,
  format,
  canManage,
}: {
  nodes: BracketNodeView[];
  format: string;
  canManage: boolean;
}) {
  if (!nodes.length) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
        The bracket has not been generated yet.
      </p>
    );
  }

  if (format === "round_robin") {
    const rr = nodes.filter((n) => n.bracket === "round_robin");
    const standings = computeStandings(rr);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <Standings rows={standings} />
          </div>
          <div className="min-w-0">
            <CrossTable rows={standings} nodes={rr} />
          </div>
        </div>
        {/* Round robin has no single node that decides the title, so results
            are grouped by matchday rather than advanced through a bracket. */}
        <MatchdayResults nodes={rr} canManage={canManage} />
      </div>
    );
  }

  const winners = nodes.filter((n) => n.bracket === "winners");
  const losers = nodes.filter((n) => n.bracket === "losers");
  const grandFinal = nodes
    .filter((n) => n.bracket === "grand_final")
    .sort((a, b) => a.roundIndex - b.roundIndex);
  const thirdPlace = nodes.filter((n) => n.bracket === "third_place");
  const isDouble = losers.length > 0;

  // The champion-deciding node: the last decided grand-final game for double
  // elimination, otherwise the winners-bracket final for single elimination.
  const decidedGrandFinals = grandFinal.filter((n) => n.status === "complete");
  const winnersFinal = [...winners].sort(
    (a, b) => b.roundIndex - a.roundIndex || b.slotIndex - a.slotIndex,
  )[0];
  const terminalId = grandFinal.length
    ? (decidedGrandFinals[decidedGrandFinals.length - 1]?.id ?? null)
    : (winnersFinal?.id ?? null);

  return (
    <div className="space-y-8">
      {isDouble ? (
        <div className="overflow-x-auto pb-3">
          <div className="flex min-w-max items-start gap-8">
            <div className="space-y-8">
              <Columns
                nodes={winners}
                canManage={canManage}
                variant="wb"
                title="Winners bracket"
                terminalId={terminalId}
                extraLastColumn={thirdPlace}
                scroll={false}
              />
              <Columns
                nodes={losers}
                canManage={canManage}
                variant="lb"
                title="Losers bracket"
                terminalId={terminalId}
                scroll={false}
              />
            </div>
            {grandFinal.length ? (
              <div className="space-y-3 self-center">
                <h3 className="text-sm font-medium">Grand final</h3>
                <div className="flex gap-6">
                  {grandFinal.map((node) => (
                    <MatchCard
                      key={node.id}
                      node={node}
                      canManage={canManage}
                      terminalId={terminalId}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <Columns
          nodes={winners}
          canManage={canManage}
          variant="se"
          terminalId={terminalId}
          extraLastColumn={thirdPlace}
        />
      )}
      {!isDouble && grandFinal.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Grand final</h3>
          <div className="flex gap-6">
            {grandFinal.map((node) => (
              <MatchCard
                key={node.id}
                node={node}
                canManage={canManage}
                terminalId={terminalId}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
