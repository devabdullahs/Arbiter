"use client";

import { ClipboardCheck, FileUp, Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

import {
  submitWebEvidence,
  submitWebScore,
  updateWebMatchStatus,
} from "./actions";

export function MatchActionsPanel({
  code,
  teamAName,
  teamBName,
  teamAScore,
  teamBScore,
}: {
  code: string;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
}) {
  const scoreAction = submitWebScore.bind(null, code);
  const evidenceAction = submitWebEvidence.bind(null, code);
  const statusAction = updateWebMatchStatus.bind(null, code);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <form action={scoreAction} className="space-y-3 rounded-xl border p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <ClipboardCheck className="size-4" />
            Score
          </h2>
          <p className="text-muted-foreground text-xs">
            Updates the web match and queues Discord panel refresh.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs font-medium">{teamAName}</span>
            <Input
              name="teamAScore"
              type="number"
              min={0}
              defaultValue={teamAScore}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">{teamBName}</span>
            <Input
              name="teamBScore"
              type="number"
              min={0}
              defaultValue={teamBScore}
              required
            />
          </label>
        </div>
        <label className="space-y-1">
          <span className="text-xs font-medium">Scoring type</span>
          <NativeSelect
            name="scoringType"
            defaultValue="match"
            className="h-8"
          >
            <option value="match">Whole match</option>
            <option value="map">Map/game</option>
            <option value="round">Round based</option>
            <option value="penalty">Penalty adjustment</option>
          </NativeSelect>
        </label>
        <Input name="comment" placeholder="Optional score note" maxLength={500} />
        <Button type="submit" className="w-full">
          Save Score
        </Button>
      </form>

      <form action={evidenceAction} className="space-y-3 rounded-xl border p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <FileUp className="size-4" />
            Evidence
          </h2>
          <p className="text-muted-foreground text-xs">
            Add a screenshot link or upload an image.
          </p>
        </div>
        <Input name="url" type="url" placeholder="https://..." maxLength={1000} />
        <textarea
          name="note"
          rows={3}
          maxLength={500}
          placeholder="What does this evidence prove?"
          className="border-input bg-background w-full rounded-lg border px-2.5 py-2 text-sm outline-none"
        />
        <input
          name="evidence"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="text-sm file:mr-3 file:h-8 file:rounded-lg file:border file:border-input file:bg-background file:px-3 file:text-sm"
        />
        <Button type="submit" className="w-full">
          Add Evidence
        </Button>
      </form>

      <form action={statusAction} className="space-y-3 rounded-xl border p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Flag className="size-4" />
            Status / ruling
          </h2>
          <p className="text-muted-foreground text-xs">
            Close, cancel, or flag a match for review.
          </p>
        </div>
        <NativeSelect
          name="status"
          defaultValue="COMPLETE"
          className="h-8"
        >
          <option value="LIVE">Live</option>
          <option value="DISPUTED">Disputed</option>
          <option value="COMPLETE">Complete</option>
          <option value="CANCELLED">Cancelled</option>
        </NativeSelect>
        <textarea
          name="reason"
          rows={4}
          maxLength={500}
          placeholder="Reason, ruling, forfeit, DQ, or admin note"
          className="border-input bg-background w-full rounded-lg border px-2.5 py-2 text-sm outline-none"
        />
        <Button type="submit" className="w-full">
          Update Status
        </Button>
      </form>
    </div>
  );
}
