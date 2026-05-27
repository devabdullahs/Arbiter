"use client";

import type { ReactNode } from "react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ClipboardCheck, FileUp, Flag, NotebookPen, Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

import {
  submitWebBrAdjustmentWithState,
  submitWebBrLogWithState,
  submitWebBrResultsWithState,
  updateWebBrStatusWithState,
} from "../actions";

type BrTeamOption = {
  id: string;
  name: string;
  seed: number | null;
  latestResult: {
    gameNumber: number;
    placement: number;
    kills: number;
    points: number;
  } | null;
};

function teamResultTemplate(teams: BrTeamOption[]) {
  return teams
    .map(
      (team, index) =>
        `${team.name} ${team.latestResult?.placement ?? index + 1} ${
          team.latestResult?.kills ?? 0
        }`,
    )
    .join("\n");
}

function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium">{label}</span>
      {children}
      {hint ? <span className="text-muted-foreground block text-xs">{hint}</span> : null}
    </label>
  );
}

function ActionFeedback({ state }: { state: { error?: string; success?: string } }) {
  if (!state.error && !state.success) return null;
  return (
    <p
      className={
        state.error
          ? "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300"
      }
    >
      {state.error ?? state.success}
    </p>
  );
}

function SubmitActionButton({
  children,
  variant,
}: {
  children: ReactNode;
  variant?: "default" | "outline";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" variant={variant} disabled={pending}>
      {pending ? "Saving" : children}
    </Button>
  );
}

export function BrActionsPanel({
  code,
  teams,
  nextGameNumber,
  lastGameNumber,
}: {
  code: string;
  teams: BrTeamOption[];
  nextGameNumber: number;
  lastGameNumber: number | null;
}) {
  const [resultState, resultAction] = useActionState(
    submitWebBrResultsWithState.bind(null, code),
    {},
  );
  const [adjustmentState, adjustmentAction] = useActionState(
    submitWebBrAdjustmentWithState.bind(null, code),
    {},
  );
  const [logState, logAction] = useActionState(
    submitWebBrLogWithState.bind(null, code),
    {},
  );
  const [statusState, statusAction] = useActionState(
    updateWebBrStatusWithState.bind(null, code),
    {},
  );
  const [adjustTeamId, setAdjustTeamId] = useState("");
  const selectedAdjustTeam = useMemo(
    () => teams.find((team) => team.id === adjustTeamId) ?? null,
    [adjustTeamId, teams],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form action={resultAction} className="space-y-3 rounded-xl border p-4 xl:row-span-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <ClipboardCheck className="size-4" />
            Log game
          </h2>
          <p className="text-muted-foreground text-xs">
            Team names are prefilled. Latest saved placement/kills are copied
            when available, so refs can adjust the numbers quickly.
          </p>
        </div>
        <ActionFeedback state={resultState} />
        <FieldLabel
          label="Game number"
          hint={
            lastGameNumber
              ? `Last saved game: ${lastGameNumber}. Change this to edit a previous game.`
              : "First game defaults to 1."
          }
        >
          <Input
            name="gameNumber"
            type="number"
            min={1}
            max={100}
            defaultValue={nextGameNumber}
            required
          />
        </FieldLabel>
        <FieldLabel
          label="Game results"
          hint="One team per line: Team Name placement kills. Leave team names unchanged."
        >
          <textarea
            name="results"
            rows={Math.min(18, Math.max(8, teams.length))}
            required
            defaultValue={teamResultTemplate(teams)}
            className="border-input bg-background min-h-56 w-full resize-y rounded-lg border px-2.5 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </FieldLabel>
        <SubmitActionButton>Save Game Results</SubmitActionButton>
      </form>

      <form action={adjustmentAction} className="space-y-3 rounded-xl border p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Scale className="size-4" />
            Adjustment / penalty
          </h2>
          <p className="text-muted-foreground text-xs">
            Use this for penalties or corrections. Values are deltas: negative
            numbers deduct points/kills, positive numbers add them.
          </p>
        </div>
        <ActionFeedback state={adjustmentState} />
        <FieldLabel
          label="Team"
          hint={
            selectedAdjustTeam?.latestResult
              ? `Latest: game ${selectedAdjustTeam.latestResult.gameNumber}, #${selectedAdjustTeam.latestResult.placement}, ${selectedAdjustTeam.latestResult.kills} kills, ${selectedAdjustTeam.latestResult.points} points.`
              : "Select the team receiving the correction or penalty."
          }
        >
          <NativeSelect
            name="brTeamId"
            required
            value={adjustTeamId}
            onChange={(event) => setAdjustTeamId(event.target.value)}
            className="h-8"
          >
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.seed ? `#${team.seed} ` : ""}
                {team.name}
              </option>
            ))}
          </NativeSelect>
        </FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          <FieldLabel label="Point delta" hint="Example: -3">
            <Input name="points" type="number" defaultValue={0} />
          </FieldLabel>
          <FieldLabel label="Kill delta" hint="Example: -1">
            <Input name="kills" type="number" defaultValue={0} />
          </FieldLabel>
          <FieldLabel label="Game" hint="Optional">
            <Input
              key={selectedAdjustTeam?.id ?? "no-team"}
              name="gameNumber"
              type="number"
              min={1}
              defaultValue={selectedAdjustTeam?.latestResult?.gameNumber}
              placeholder="Game"
            />
          </FieldLabel>
        </div>
        <FieldLabel label="Reason" hint="Required for audit history.">
          <Input
            name="reason"
            required
            maxLength={500}
            placeholder="Rule 4.2 penalty, scoreboard correction, admin ruling..."
          />
        </FieldLabel>
        <SubmitActionButton variant="outline">Apply Adjustment</SubmitActionButton>
      </form>

      <form action={logAction} className="space-y-3 rounded-xl border p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <NotebookPen className="size-4" />
            Referee log
          </h2>
          <p className="text-muted-foreground text-xs">
            Pause, warning, evidence, dispute, or general note.
          </p>
        </div>
        <ActionFeedback state={logState} />
        <div className="grid gap-2 sm:grid-cols-2">
          <FieldLabel label="Log type">
            <NativeSelect name="kind" defaultValue="note" className="h-8">
              <option value="note">Note</option>
              <option value="pause">Pause</option>
              <option value="warning">Warning</option>
              <option value="evidence">Evidence</option>
              <option value="dispute">Dispute</option>
            </NativeSelect>
          </FieldLabel>
          <FieldLabel label="Scope">
            <NativeSelect name="brTeamId" className="h-8">
              <option value="">Lobby-wide</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </NativeSelect>
          </FieldLabel>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <FieldLabel label="Game" hint="Optional">
            <Input
              name="gameNumber"
              type="number"
              min={1}
              defaultValue={lastGameNumber ?? undefined}
              placeholder="Game"
            />
          </FieldLabel>
          <FieldLabel label="Pause minutes" hint="For pauses">
            <Input
              name="durationMinutes"
              type="number"
              min={0}
              placeholder="Minutes"
            />
          </FieldLabel>
          <FieldLabel label="Rule" hint="Optional">
            <Input name="rule" placeholder="Rule ID" maxLength={80} />
          </FieldLabel>
        </div>
        <FieldLabel label="Subject" hint="Player, team, or issue title.">
          <Input name="subject" placeholder="Player, team, or subject" maxLength={80} />
        </FieldLabel>
        <FieldLabel label="Summary" hint="Short line shown in the log table.">
          <Input name="summary" placeholder="Short summary" maxLength={500} />
        </FieldLabel>
        <FieldLabel label="Details" hint="Ruling context, referee note, or dispute details.">
          <textarea
            name="details"
            rows={3}
            maxLength={1000}
            placeholder="Details, ruling context, or referee note"
            className="border-input bg-background w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </FieldLabel>
        <FieldLabel label="Evidence URL" hint="Optional screenshot or clip link.">
          <Input
            name="attachmentUrl"
            type="url"
            placeholder="https://..."
            maxLength={1000}
          />
        </FieldLabel>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <FileUp className="size-4 shrink-0" />
          <span className="font-medium">Upload evidence</span>
          <input
            name="evidence"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="min-w-0 text-sm file:mr-3 file:h-8 file:rounded-lg file:border file:border-input file:bg-background file:px-3 file:text-sm"
          />
        </label>
        <SubmitActionButton variant="outline">Add Referee Log</SubmitActionButton>
      </form>

      <form action={statusAction} className="space-y-3 rounded-xl border p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Flag className="size-4" />
            Status / ruling
          </h2>
          <p className="text-muted-foreground text-xs">
            Finalize, cancel, reopen, or mark the lobby disputed.
          </p>
        </div>
        <ActionFeedback state={statusState} />
        <FieldLabel label="New status">
          <NativeSelect name="status" defaultValue="COMPLETE" className="h-8">
            <option value="PENDING">Pending</option>
            <option value="LIVE">Live</option>
            <option value="DISPUTED">Disputed</option>
            <option value="COMPLETE">Complete</option>
            <option value="CANCELLED">Cancelled</option>
          </NativeSelect>
        </FieldLabel>
        <FieldLabel label="Reason" hint="Optional, but useful for final reviews.">
          <textarea
            name="reason"
            rows={3}
            maxLength={500}
            placeholder="Final ruling, cancellation reason, or admin note"
            className="border-input bg-background w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </FieldLabel>
        <SubmitActionButton>Update Lobby Status</SubmitActionButton>
      </form>
    </div>
  );
}
