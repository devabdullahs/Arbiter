"use client";

import { ClipboardCheck, FileUp, Flag, NotebookPen, Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  submitWebBrAdjustment,
  submitWebBrLog,
  submitWebBrResults,
  updateWebBrStatus,
} from "../actions";

type BrTeamOption = {
  id: string;
  name: string;
  seed: number | null;
};

function teamResultTemplate(teams: BrTeamOption[]) {
  return teams
    .map((team, index) => `${team.name} ${index + 1} 0`)
    .join("\n");
}

export function BrActionsPanel({
  code,
  teams,
  nextGameNumber,
}: {
  code: string;
  teams: BrTeamOption[];
  nextGameNumber: number;
}) {
  const resultAction = submitWebBrResults.bind(null, code);
  const adjustmentAction = submitWebBrAdjustment.bind(null, code);
  const logAction = submitWebBrLog.bind(null, code);
  const statusAction = updateWebBrStatus.bind(null, code);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form action={resultAction} className="space-y-3 rounded-xl border p-4 xl:row-span-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <ClipboardCheck className="size-4" />
            Log game
          </h2>
          <p className="text-muted-foreground text-xs">
            Team names are prefilled. Change only placement and kill numbers.
          </p>
        </div>
        <label className="space-y-1">
          <span className="text-xs font-medium">Game number</span>
          <Input
            name="gameNumber"
            type="number"
            min={1}
            max={100}
            defaultValue={nextGameNumber}
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium">Results</span>
          <textarea
            name="results"
            rows={Math.min(18, Math.max(8, teams.length))}
            required
            defaultValue={teamResultTemplate(teams)}
            className="border-input bg-background min-h-56 w-full resize-y rounded-lg border px-2.5 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <Button type="submit" className="w-full">
          Save Game Results
        </Button>
      </form>

      <form action={adjustmentAction} className="space-y-3 rounded-xl border p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Scale className="size-4" />
            Adjustment / penalty
          </h2>
          <p className="text-muted-foreground text-xs">
            Applies directly to standings totals.
          </p>
        </div>
        <select
          name="brTeamId"
          required
          className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
        >
          <option value="">Select team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.seed ? `#${team.seed} ` : ""}
              {team.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <Input name="points" type="number" defaultValue={0} placeholder="Points" />
          <Input name="kills" type="number" defaultValue={0} placeholder="Kills" />
          <Input name="gameNumber" type="number" min={1} placeholder="Game" />
        </div>
        <Input name="reason" required maxLength={500} placeholder="Reason" />
        <Button type="submit" className="w-full" variant="outline">
          Apply Adjustment
        </Button>
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
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            name="kind"
            defaultValue="note"
            className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
          >
            <option value="note">Note</option>
            <option value="pause">Pause</option>
            <option value="warning">Warning</option>
            <option value="evidence">Evidence</option>
            <option value="dispute">Dispute</option>
          </select>
          <select
            name="brTeamId"
            className="border-input bg-background h-8 rounded-lg border px-2.5 text-sm"
          >
            <option value="">Lobby-wide</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input name="gameNumber" type="number" min={1} placeholder="Game" />
          <Input name="durationMinutes" type="number" min={0} placeholder="Minutes" />
          <Input name="rule" placeholder="Rule" maxLength={80} />
        </div>
        <Input name="subject" placeholder="Player, team, or subject" maxLength={80} />
        <Input name="summary" placeholder="Short summary" maxLength={500} />
        <textarea
          name="details"
          rows={3}
          maxLength={1000}
          placeholder="Details, ruling context, or referee note"
          className="border-input bg-background w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Input name="attachmentUrl" type="url" placeholder="Evidence URL" maxLength={1000} />
        <label className="flex items-center gap-2 text-sm">
          <FileUp className="size-4" />
          <input
            name="evidence"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="min-w-0 text-sm file:mr-3 file:h-8 file:rounded-lg file:border file:border-input file:bg-background file:px-3 file:text-sm"
          />
        </label>
        <Button type="submit" className="w-full" variant="outline">
          Add Referee Log
        </Button>
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
        <select
          name="status"
          defaultValue="COMPLETE"
          className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm"
        >
          <option value="PENDING">Pending</option>
          <option value="LIVE">Live</option>
          <option value="DISPUTED">Disputed</option>
          <option value="COMPLETE">Complete</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <textarea
          name="reason"
          rows={3}
          maxLength={500}
          placeholder="Final ruling, cancellation reason, or admin note"
          className="border-input bg-background w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" className="w-full">
          Update Lobby Status
        </Button>
      </form>
    </div>
  );
}
