"use client";

import { ClipboardCheck, FileUp, Flag, MapPinned, Play, Swords } from "lucide-react";

import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { BUILT_IN_PRESETS } from "@/lib/game-presets";
import { RESULT_LABEL_OPTIONS } from "@/lib/score-format";

import {
  addExtraMapVeto,
  endWebCharacterBans,
  endWebVeto,
  grantWebVetoExtraTurn,
  pauseWebVeto,
  restartWebVetoFromPoint,
  skipWebVetoTurn,
  startWebCharacterBans,
  startWebMatch,
  startWebVeto,
  submitWebCharacterBanAction,
  submitWebEvidence,
  submitWebMapScore,
  submitWebScore,
  submitWebVetoAction,
  updateWebMatchSettings,
  updateWebMatchStatus,
} from "./actions";
import { VetoCountdown } from "./veto-countdown";

type VetoActionRow = {
  id: string;
  kind: string;
  teamSlot: string;
  mapName: string;
  source?: string;
};

type CharacterBanRow = {
  id: string;
  teamSlot: string;
  action: string;
  character: string;
  gameRole: string | null;
  source: string;
};

type MapResultRow = {
  id: string;
  mapIndex: number;
  mapName: string;
  teamAScore: number;
  teamBScore: number;
  teamAResult: string | null;
  teamBResult: string | null;
  status: string;
};

type RulesPresetOption = {
  id: string;
  key: string;
  label: string;
  gameTitle: string | null;
  mapCount: number;
  characterCount: number;
};

type MapEntry = string | { map?: string; mode?: string };

function mapNameOf(entry: MapEntry) {
  return typeof entry === "string" ? entry : entry.map ?? "";
}

function mapModeOf(entry: MapEntry) {
  return typeof entry === "string" ? null : entry.mode ?? null;
}

function normalizeMapPool(mapPool: MapEntry[]) {
  return mapPool
    .map((entry) => ({ name: mapNameOf(entry), mode: mapModeOf(entry) }))
    .filter((entry) => entry.name);
}

function teamLabel(slot: string, teamAName: string, teamBName: string) {
  if (slot === "teamA") return teamAName;
  if (slot === "teamB") return teamBName;
  return slot;
}

function vetoActionText(action: VetoActionRow, teamAName: string, teamBName: string) {
  const team = teamLabel(action.teamSlot, teamAName, teamBName);
  const kind = action.kind.toLowerCase();
  if (action.mapName === "__TURN_SKIPPED__") {
    return `${team} skipped ${kind} turn`;
  }
  return `${team} ${kind === "pick" ? "picked" : "banned"} ${action.mapName}`;
}

function otherTeamSlot(slot: string) {
  return slot === "teamB" ? "teamA" : "teamB";
}

function nextVetoState({
  bestOf,
  vetoMode,
  vetoStartingTeam,
  mapPool,
  vetoActions,
}: {
  bestOf: number;
  vetoMode: string;
  vetoStartingTeam: string;
  mapPool: MapEntry[];
  vetoActions: VetoActionRow[];
}) {
  const picks = vetoActions.filter((action) => action.kind === "PICK");
  const bans = vetoActions.filter((action) => action.kind === "BAN");
  const startingTeam = vetoStartingTeam === "teamB" ? "teamB" : "teamA";
  const turnFor = (count: number) =>
    count % 2 === 0 ? startingTeam : otherTeamSlot(startingTeam);

  if (vetoMode === "series_picks" || vetoMode === "manual_picks") {
    return {
      kind: "PICK",
      teamSlot: turnFor(picks.length),
      complete:
        vetoMode === "series_picks" &&
        picks.length >= Math.min(bestOf, mapPool.length),
    };
  }

  const bansNeeded = Math.max(0, mapPool.length - bestOf);
  return {
    kind: bans.length < bansNeeded ? "BAN" : "PICK",
    teamSlot: turnFor(bans.length + picks.length),
    complete: false,
  };
}

export function MatchActionsPanel({
  code,
  teamAName,
  teamBName,
  teamAScore,
  teamBScore,
  teamAResult,
  teamBResult,
  bestOf,
  rulesPreset,
  rulesPresets,
  status,
  vetoMode,
  vetoStartingTeam,
  vetoTimerSeconds,
  vetoTimeoutAction,
  characterBanMode,
  characterBanTimerSeconds,
  characterPool,
  mapPool,
  finalMap,
  turnStartedAt,
  vetoActions,
  characterBanActions,
  characterBanStarted,
  mapResults,
}: {
  code: string;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  teamAResult: string | null;
  teamBResult: string | null;
  bestOf: number;
  rulesPreset: string;
  rulesPresets: RulesPresetOption[];
  status: string;
  vetoMode: string;
  vetoStartingTeam: string;
  vetoTimerSeconds: number;
  vetoTimeoutAction: string;
  characterBanMode: string;
  characterBanTimerSeconds: number;
  characterBanStarted: boolean;
  characterPool: MapEntry[];
  mapPool: MapEntry[];
  finalMap: string | null;
  turnStartedAt: string | null;
  vetoActions: VetoActionRow[];
  characterBanActions: CharacterBanRow[];
  mapResults: MapResultRow[];
}) {
  const scoreAction = submitWebScore.bind(null, code);
  const settingsAction = updateWebMatchSettings.bind(null, code);
  const startMatchAction = startWebMatch.bind(null, code);
  const mapScoreAction = submitWebMapScore.bind(null, code);
  const extraMapVetoAction = addExtraMapVeto.bind(null, code);
  const evidenceAction = submitWebEvidence.bind(null, code);
  const statusAction = updateWebMatchStatus.bind(null, code);
  const startVetoAction = startWebVeto.bind(null, code);
  const pauseVetoAction = pauseWebVeto.bind(null, code);
  const endVetoAction = endWebVeto.bind(null, code);
  const vetoAction = submitWebVetoAction.bind(null, code);
  const extraTurnAction = grantWebVetoExtraTurn.bind(null, code);
  const skipTurnAction = skipWebVetoTurn.bind(null, code);
  const restartVetoAction = restartWebVetoFromPoint.bind(null, code);
  const characterBanAction = submitWebCharacterBanAction.bind(null, code);
  const startCharacterBansAction = startWebCharacterBans.bind(null, code);
  const endCharacterBansAction = endWebCharacterBans.bind(null, code);
  const maps = normalizeMapPool(mapPool);
  const usedMaps = new Set(
    vetoActions
      .map((action) => action.mapName)
      .filter((mapName) => !mapName.startsWith("__")),
  );
  const remainingMaps = maps.filter((entry) => !usedMaps.has(entry.name));
  const nextVeto = nextVetoState({
    bestOf,
    vetoMode,
    vetoStartingTeam,
    mapPool,
    vetoActions,
  });
  const vetoStarted = status === "VETO" || vetoActions.length > 0;
  const vetoComplete = Boolean(finalMap) || nextVeto.complete;
  const characterPoolEntries = normalizeMapPool(characterPool);
  const usedCharacters = new Set(
    characterBanActions.map((action) => action.character.toLowerCase()),
  );
  const nextCharacterTeam =
    characterBanActions.length % 2 === 0
      ? (vetoStartingTeam === "teamB" ? "teamB" : "teamA")
      : otherTeamSlot(vetoStartingTeam === "teamB" ? "teamB" : "teamA");
  const playedMapNames = new Set(mapResults.map((entry) => entry.mapName));
  const unplayedMaps = maps.filter((entry) => !playedMapNames.has(entry.name));
  const lastMapResult = mapResults.at(-1);
  const lastMapIsDraw = lastMapResult?.status === "draw";
  const startMapOptions = unplayedMaps.length ? unplayedMaps : maps;
  const mapPoolText = maps.map((entry) => entry.name).join("\n");
  const characterPoolText = characterPoolEntries.map((entry) => entry.name).join("\n");
  const selectedOrgPreset = rulesPresets.find((preset) => preset.key === rulesPreset);
  const selectedBuiltInPreset = BUILT_IN_PRESETS.find(
    (preset) => preset.key === rulesPreset,
  );
  const selectedRulesPresetValue = selectedOrgPreset
    ? `org:${selectedOrgPreset.id}`
    : selectedBuiltInPreset
      ? selectedBuiltInPreset.key
      : rulesPreset;

  return (
    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
      <form action={settingsAction} className="space-y-3 rounded-xl border p-4 xl:col-span-2 2xl:col-span-4">
        <div>
          <h2 className="text-sm font-medium">Match settings</h2>
          <p className="text-muted-foreground text-xs">
            Per-match rules, veto timing, pools, and character-ban behavior.
            These changes refresh the Discord panel too.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium">Best of</span>
            <Input name="bestOf" type="number" min={1} max={99} defaultValue={bestOf} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">Rules preset</span>
            <NativeSelect
              name="rulesPreset"
              defaultValue={selectedRulesPresetValue}
              className="h-9"
            >
              {!selectedOrgPreset && !selectedBuiltInPreset ? (
                <option value={rulesPreset}>Current: {rulesPreset}</option>
              ) : null}
              <optgroup label="Built-in presets">
                {BUILT_IN_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.label}
                  </option>
                ))}
              </optgroup>
              {rulesPresets.length ? (
                <optgroup label="Organization presets">
                  {rulesPresets.map((preset) => (
                    <option key={preset.id} value={`org:${preset.id}`}>
                      {preset.label}
                      {preset.gameTitle ? ` (${preset.gameTitle})` : ""} -{" "}
                      {preset.mapCount} maps
                      {preset.characterCount
                        ? `, ${preset.characterCount} characters`
                        : ""}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </NativeSelect>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">First veto turn</span>
            <NativeSelect name="vetoStartingTeam" defaultValue={vetoStartingTeam} className="h-9">
              <option value="teamA">{teamAName}</option>
              <option value="teamB">{teamBName}</option>
            </NativeSelect>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">Veto format</span>
            <NativeSelect name="vetoMode" defaultValue={vetoMode} className="h-9">
              <option value="series_picks">Series picks</option>
              <option value="final_map_ban">Final map from bans</option>
              <option value="manual_picks">Manual picks</option>
            </NativeSelect>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">Turn timer</span>
            <Input
              name="vetoTimerSeconds"
              type="number"
              min={10}
              max={900}
              defaultValue={vetoTimerSeconds}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">Missed turn</span>
            <NativeSelect name="vetoTimeoutAction" defaultValue={vetoTimeoutAction} className="h-9">
              <option value="referee_choice">Referee chooses</option>
              <option value="timeout_skip">Skip turn</option>
              <option value="timeout_extra_turn">Give extra turn</option>
            </NativeSelect>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">Character system</span>
            <NativeSelect name="characterBanMode" defaultValue={characterBanMode} className="h-9">
              <option value="none">None</option>
              <option value="generic">Generic bans</option>
              <option value="valorant_protect_ban">Valorant protect / ban</option>
              <option value="lol_fearless_draft">LoL Fearless draft</option>
              <option value="owcs_ranked_vote">OWCS ranked vote</option>
            </NativeSelect>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">Character timer</span>
            <Input
              name="characterBanTimerSeconds"
              type="number"
              min={10}
              max={900}
              defaultValue={characterBanTimerSeconds}
            />
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium">Map pool</span>
            <textarea
              name="mapPool"
              rows={5}
              defaultValue={mapPoolText}
              placeholder="One map per line"
              className="border-input bg-background w-full rounded-lg border px-2.5 py-2 text-sm outline-none"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">Character pool</span>
            <textarea
              name="characterPool"
              rows={5}
              defaultValue={characterPoolText}
              placeholder="One character per line"
              className="border-input bg-background w-full rounded-lg border px-2.5 py-2 text-sm outline-none"
            />
          </label>
        </div>
        <PendingSubmitButton className="w-full" pendingChildren="Saving settings...">
          Save Match Settings
        </PendingSubmitButton>
      </form>

      <div className="space-y-3 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <MapPinned className="size-4" />
              Live veto
            </h2>
            <p className="text-muted-foreground text-xs">
              Visible to everyone watching this match page. Each turn has{" "}
              {vetoTimerSeconds}s; missed turns use:{" "}
              {vetoTimeoutAction.replaceAll("_", " ")}.
            </p>
          </div>
          <Badge variant={vetoStarted ? "default" : "outline"}>
            {vetoComplete ? "Complete" : vetoStarted ? "Live" : "Ready"}
          </Badge>
        </div>

        <div className="rounded-lg border p-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground text-xs">Format</p>
              <p className="font-medium">{vetoMode.replaceAll("_", " ")}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Next action</p>
              <p className="font-medium">
                {vetoComplete
                  ? "No action"
                  : `${teamLabel(nextVeto.teamSlot, teamAName, teamBName)} ${nextVeto.kind.toLowerCase()}`}
              </p>
            </div>
          </div>
          {finalMap ? (
            <p className="mt-3 text-sm">
              Final map: <span className="font-medium">{finalMap}</span>
            </p>
          ) : null}
        </div>

        <VetoCountdown
          durationSeconds={vetoTimerSeconds}
          startedAt={vetoStarted ? turnStartedAt : null}
          complete={vetoComplete}
        />

        {vetoActions.length ? (
          <ol className="scrollbar-thin flex max-h-40 flex-col gap-2 overflow-auto pr-1 text-sm">
            {vetoActions.map((action, index) => (
              <li key={action.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <span>
                  <span className="text-muted-foreground mr-2 tabular-nums">
                    {index + 1}.
                  </span>
                  {vetoActionText(action, teamAName, teamBName)}
                </span>
                <Badge variant="outline">{action.source ?? action.kind}</Badge>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            No veto actions yet.
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          <form action={startVetoAction}>
            <PendingSubmitButton
              className="w-full"
              variant={vetoStarted ? "outline" : "default"}
              pendingChildren={vetoStarted ? "Resuming..." : "Starting..."}
            >
              <Play className="size-4" />
              {vetoStarted ? "Resume" : "Start"} Veto
            </PendingSubmitButton>
          </form>
          <form action={pauseVetoAction}>
            <PendingSubmitButton
              className="w-full"
              variant="outline"
              pendingChildren="Pausing..."
              disabled={!vetoStarted || vetoComplete}
            >
              Pause Veto
            </PendingSubmitButton>
          </form>
          <form action={endVetoAction}>
            <PendingSubmitButton
              className="w-full"
              variant="outline"
              pendingChildren="Ending..."
              disabled={!vetoStarted}
            >
              End Veto
            </PendingSubmitButton>
          </form>
        </div>

        {vetoStarted && !vetoComplete ? (
          <div className="space-y-2">
            <form action={vetoAction} className="space-y-2">
              <NativeSelect name="mapName" required className="h-9">
                <option value="">Select next map</option>
                {remainingMaps.map((map) => (
                  <option key={map.name} value={map.name}>
                    {map.mode ? `${map.mode} - ${map.name}` : map.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect name="source" defaultValue="team" className="h-9">
                <option value="team">Team submitted in time</option>
                <option value="referee_choice">Referee chooses for team</option>
              </NativeSelect>
              <Input name="note" placeholder="Optional veto note" maxLength={240} />
              <PendingSubmitButton className="w-full" pendingChildren="Saving veto...">
                Save {nextVeto.kind === "BAN" ? "Ban" : "Pick"}
              </PendingSubmitButton>
            </form>
            <div className="grid gap-2 sm:grid-cols-2">
              <form action={extraTurnAction}>
                <PendingSubmitButton
                  className="w-full"
                  variant="outline"
                  pendingChildren="Granting..."
                >
                  Give Extra Turn
                </PendingSubmitButton>
              </form>
              <form action={skipTurnAction}>
                <PendingSubmitButton
                  className="w-full"
                  variant="outline"
                  pendingChildren="Skipping..."
                >
                  Skip Turn
                </PendingSubmitButton>
              </form>
            </div>
          </div>
        ) : null}

        {vetoStarted ? (
          <form action={restartVetoAction} className="rounded-lg border p-3">
            <div className="mb-2">
              <p className="text-sm font-medium">Restart / rollback veto</p>
              <p className="text-muted-foreground text-xs">
                Start over, or keep the timeline through a specific turn and
                replay from there.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <NativeSelect name="rollbackPoint" defaultValue="start" className="h-9">
                <option value="start">Restart from the beginning</option>
                {vetoActions.map((action, index) => (
                  <option key={action.id} value={action.id}>
                    Keep through turn {index + 1}:{" "}
                    {vetoActionText(action, teamAName, teamBName)}
                  </option>
                ))}
              </NativeSelect>
              <PendingSubmitButton
                variant="outline"
                pendingChildren="Rolling back..."
              >
                Restart
              </PendingSubmitButton>
            </div>
          </form>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Flag className="size-4" />
              Character bans
            </h2>
            <p className="text-muted-foreground text-xs">
              Supports generic bans, VCT protects/bans, LoL Fearless locks, and
              OWCS vote records. Each action has {characterBanTimerSeconds}s.
            </p>
          </div>
          <Badge variant={characterBanMode === "none" ? "outline" : "default"}>
            {characterBanMode.replaceAll("_", " ")}
          </Badge>
        </div>

        {characterBanActions.length ? (
          <ol className="scrollbar-thin flex max-h-40 flex-col gap-2 overflow-auto pr-1 text-sm">
            {characterBanActions.map((action, index) => (
              <li key={action.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <span>
                  <span className="text-muted-foreground mr-2 tabular-nums">
                    {index + 1}.
                  </span>
                  <span className="font-medium">
                    {teamLabel(action.teamSlot, teamAName, teamBName)}
                  </span>{" "}
                  {action.action.replaceAll("_", " ")} {action.character}
                  {action.gameRole ? ` (${action.gameRole})` : ""}
                </span>
                <Badge variant="outline">{action.source}</Badge>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            No character bans yet.
          </p>
        )}

        {characterBanMode !== "none" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <form action={startCharacterBansAction}>
              <PendingSubmitButton
                className="w-full"
                variant={characterBanStarted ? "outline" : "default"}
                pendingChildren={characterBanStarted ? "Resuming..." : "Starting..."}
                disabled={characterBanStarted}
              >
                <Play className="size-4" />
                {characterBanStarted ? "Bans Started" : "Start Character Bans"}
              </PendingSubmitButton>
            </form>
            <form action={endCharacterBansAction}>
              <PendingSubmitButton
                className="w-full"
                variant="outline"
                pendingChildren="Ending..."
                disabled={!characterBanStarted}
              >
                End Character Bans
              </PendingSubmitButton>
            </form>
          </div>
        ) : null}

        {characterBanMode === "none" ? (
          <p className="text-muted-foreground text-xs">
            Enable a character ban system when creating the match.
          </p>
        ) : !characterBanStarted ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
            Start character bans so teams can submit their picks, or enter them
            manually below once started.
          </p>
        ) : (
          <form action={characterBanAction} className="space-y-2">
            <p className="text-muted-foreground text-xs">
              Next action: {teamLabel(nextCharacterTeam, teamAName, teamBName)}
            </p>
            <NativeSelect name="action" defaultValue="ban" className="h-9">
              <option value="ban">Ban</option>
              <option value="protect">Protect</option>
              <option value="vote">OWCS ranked vote winner</option>
              <option value="fearless_lock">LoL Fearless lock</option>
            </NativeSelect>
            {characterPoolEntries.length ? (
              <NativeSelect name="character" required className="h-9">
                <option value="">Select character</option>
                {characterPoolEntries
                  .filter((entry) => !usedCharacters.has(entry.name.toLowerCase()))
                  .map((entry) => (
                    <option key={entry.name} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
              </NativeSelect>
            ) : (
              <Input
                name="character"
                placeholder="Champion, agent, hero, or character"
                maxLength={120}
                required
              />
            )}
            <Input name="gameRole" placeholder="Optional role: Tank, Duelist, ADC..." maxLength={80} />
            <NativeSelect name="source" defaultValue="team" className="h-9">
              <option value="team">Team submitted in time</option>
              <option value="referee_choice">Referee chooses for team</option>
            </NativeSelect>
            <Input name="note" placeholder="Optional character-ban note" maxLength={240} />
            <PendingSubmitButton className="w-full" pendingChildren="Saving ban...">
              Save Character Ban
            </PendingSubmitButton>
          </form>
        )}
      </div>

      <div className="space-y-3 rounded-xl border p-4 xl:col-span-2 2xl:col-span-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Swords className="size-4" />
              Maps &amp; per-map scores
            </h2>
            <p className="text-muted-foreground text-xs">
              Start each map, submit its score, and adjust current or previous
              maps. A drawn map unlocks an extra map veto. The series score
              (maps won) updates automatically.
            </p>
          </div>
          <Badge variant={mapResults.length ? "default" : "outline"}>
            {mapResults.length} map{mapResults.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {mapResults.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {mapResults.map((map) => (
              <form
                key={map.id}
                action={mapScoreAction}
                className="space-y-2 rounded-lg border p-3"
              >
                <input type="hidden" name="mapIndex" value={map.mapIndex} />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Map {map.mapIndex + 1}: {map.mapName}
                  </p>
                  <Badge
                    variant={
                      map.status === "draw"
                        ? "destructive"
                        : map.status === "complete"
                          ? "default"
                          : "outline"
                    }
                  >
                    {map.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium">{teamAName}</span>
                    <Input
                      name="teamAScore"
                      type="number"
                      min={0}
                      defaultValue={map.teamAScore}
                      required
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium">{teamBName}</span>
                    <Input
                      name="teamBScore"
                      type="number"
                      min={0}
                      defaultValue={map.teamBScore}
                      required
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium">{teamAName} ruling</span>
                    <NativeSelect
                      name="teamAResult"
                      defaultValue={map.teamAResult ?? ""}
                      className="h-9"
                    >
                      {RESULT_LABEL_OPTIONS.map((option) => (
                        <option key={option.value || "numeric"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium">{teamBName} ruling</span>
                    <NativeSelect
                      name="teamBResult"
                      defaultValue={map.teamBResult ?? ""}
                      className="h-9"
                    >
                      {RESULT_LABEL_OPTIONS.map((option) => (
                        <option key={option.value || "numeric"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                </div>
                <Input name="note" placeholder="Optional map note" maxLength={240} />
                <PendingSubmitButton
                  className="w-full"
                  variant="outline"
                  pendingChildren="Saving map..."
                >
                  Save Map {map.mapIndex + 1} Score
                </PendingSubmitButton>
              </form>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
            No maps started yet. Start the match on a map below.
          </p>
        )}

        <form action={startMatchAction} className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">
            {mapResults.length ? "Start next map" : "Start match"}
          </p>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <NativeSelect
              name="mapName"
              required
              defaultValue={
                finalMap && startMapOptions.some((entry) => entry.name === finalMap)
                  ? finalMap
                  : ""
              }
              className="h-9"
            >
              <option value="">Select map to start</option>
              {startMapOptions.map((map) => (
                <option key={map.name} value={map.name}>
                  {map.mode ? `${map.mode} - ${map.name}` : map.name}
                </option>
              ))}
            </NativeSelect>
            <PendingSubmitButton pendingChildren="Starting...">
              <Play className="size-4" />
              {mapResults.length ? "Start Next Map" : "Start Match"}
            </PendingSubmitButton>
          </div>
        </form>

        {lastMapIsDraw ? (
          <form action={extraMapVetoAction} className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-medium">Extra map veto (after draw)</p>
            <p className="text-muted-foreground text-xs">
              Map {(lastMapResult?.mapIndex ?? 0) + 1} ({lastMapResult?.mapName})
              ended in a draw. Pick an additional map to break the tie.
            </p>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <NativeSelect name="mapName" required className="h-9">
                <option value="">Select extra map</option>
                {unplayedMaps.map((map) => (
                  <option key={map.name} value={map.name}>
                    {map.mode ? `${map.mode} - ${map.name}` : map.name}
                  </option>
                ))}
              </NativeSelect>
              <PendingSubmitButton variant="outline" pendingChildren="Adding...">
                Add Extra Map
              </PendingSubmitButton>
            </div>
          </form>
        ) : null}
      </div>

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
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs font-medium">{teamAName} ruling</span>
            <NativeSelect
              name="teamAResult"
              defaultValue={teamAResult ?? ""}
              className="h-8"
            >
              {RESULT_LABEL_OPTIONS.map((option) => (
                <option key={option.value || "numeric"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">{teamBName} ruling</span>
            <NativeSelect
              name="teamBResult"
              defaultValue={teamBResult ?? ""}
              className="h-8"
            >
              {RESULT_LABEL_OPTIONS.map((option) => (
                <option key={option.value || "numeric"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
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
        <PendingSubmitButton className="w-full" pendingChildren="Saving score...">
          Save Score
        </PendingSubmitButton>
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
        <PendingSubmitButton className="w-full" pendingChildren="Adding evidence...">
          Add Evidence
        </PendingSubmitButton>
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
        <PendingSubmitButton className="w-full" pendingChildren="Updating status...">
          Update Status
        </PendingSubmitButton>
      </form>
    </div>
  );
}
