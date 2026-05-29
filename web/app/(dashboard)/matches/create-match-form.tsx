"use client";

import { useMemo, useState, useActionState } from "react";

import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { BUILT_IN_PRESETS } from "@/lib/game-presets";

import { createWebMatchWithState } from "./actions";

type OrgOption = {
  id: string;
  name: string;
};

type TeamOption = {
  id: string;
  name: string;
  organization: OrgOption;
};

type RulesPresetOption = {
  id: string;
  key: string;
  label: string;
  gameTitle: string | null;
  organization: OrgOption;
};

export function CreateMatchForm({
  orgs,
  teams,
  rulesPresets,
  defaultOrganizationId,
}: {
  orgs: OrgOption[];
  teams: TeamOption[];
  rulesPresets: RulesPresetOption[];
  defaultOrganizationId?: string;
}) {
  const [state, formAction] = useActionState(createWebMatchWithState, {});
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [clientError, setClientError] = useState("");

  const teamOptions = useMemo(
    () =>
      teams.map((team) => ({
        id: team.id,
        label: `${team.organization.name} / ${team.name}`,
      })),
    [teams],
  );
  const error = clientError || state.error;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        setClientError("");
        if (teamAId && teamBId && teamAId === teamBId) {
          event.preventDefault();
          setClientError("Select two different teams.");
        }
      }}
    >
      {error ? (
        <FieldError className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
          {error}
        </FieldError>
      ) : null}

      <FieldSet className="rounded-lg border bg-muted/20 p-4">
        <div>
          <FieldLegend>Match setup</FieldLegend>
          <FieldDescription>
            Choose the organization, teams, format, and rule preset for this
            match.
          </FieldDescription>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Field className="xl:col-span-2">
            <FieldLabel htmlFor="match-organization">Organization</FieldLabel>
            <NativeSelect
              id="match-organization"
              name="organizationId"
              defaultValue={defaultOrganizationId}
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field className="xl:col-span-1">
            <FieldLabel htmlFor="match-best-of">Series length</FieldLabel>
            <Input
              id="match-best-of"
              name="bestOf"
              type="number"
              min={1}
              max={99}
              defaultValue={3}
              className="h-9"
            />
            <FieldDescription>Best-of or games planned.</FieldDescription>
          </Field>
          <Field className="xl:col-span-2">
            <FieldLabel htmlFor="match-rules-preset">Rules preset</FieldLabel>
            <NativeSelect
              id="match-rules-preset"
              name="rulesPreset"
              defaultValue="generic"
            >
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
                      {preset.organization.name} / {preset.label}
                      {preset.gameTitle ? ` (${preset.gameTitle})` : ""}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </NativeSelect>
          </Field>
          <Field className="xl:col-span-1">
            <FieldLabel htmlFor="match-veto-mode">Veto mode</FieldLabel>
            <NativeSelect
              id="match-veto-mode"
              name="vetoMode"
              defaultValue="series_picks"
            >
              <option value="series_picks">Series picks</option>
              <option value="final_map_ban">Final map ban</option>
              <option value="manual_picks">Manual picks</option>
            </NativeSelect>
          </Field>
          <Field className="xl:col-span-1">
            <FieldLabel htmlFor="match-veto-start">First veto turn</FieldLabel>
            <NativeSelect
              id="match-veto-start"
              name="vetoStartingTeam"
              defaultValue="teamA"
            >
              <option value="teamA">Team A starts</option>
              <option value="teamB">Team B starts</option>
            </NativeSelect>
          </Field>
          <Field className="xl:col-span-1">
            <FieldLabel htmlFor="match-veto-timer">Veto timer</FieldLabel>
            <Input
              id="match-veto-timer"
              name="vetoTimerSeconds"
              type="number"
              min={10}
              max={600}
              defaultValue={60}
              className="h-9"
            />
            <FieldDescription>Seconds per map pick or ban.</FieldDescription>
          </Field>
          <Field className="xl:col-span-2">
            <FieldLabel htmlFor="match-timeout-action">If a team misses</FieldLabel>
            <NativeSelect
              id="match-timeout-action"
              name="vetoTimeoutAction"
              defaultValue="referee_choice"
            >
              <option value="referee_choice">Referee chooses</option>
              <option value="extra_turn">Give another turn</option>
              <option value="skip">Skip the turn</option>
            </NativeSelect>
          </Field>
        </div>
      </FieldSet>

      <div className="grid gap-5 xl:grid-cols-2">
        <FieldSet className="rounded-lg border p-4">
          <div>
            <FieldLegend variant="label">Team A</FieldLegend>
            <FieldDescription>
              Link a registered team when possible so rosters and check-ins stay
              connected.
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="match-team-a">Registered team</FieldLabel>
            <NativeSelect
              id="match-team-a"
              name="teamAId"
              value={teamAId}
              onChange={(event) => {
                const value = event.target.value;
                setTeamAId(value);
                if (value && value === teamBId) setTeamBId("");
              }}
            >
              <option value="">Use a custom Team A name</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="match-team-a-custom">Custom name</FieldLabel>
            <Input
              id="match-team-a-custom"
              name="teamAName"
              placeholder={
                teamAId ? "Team A linked from roster" : "Custom Team A name"
              }
              maxLength={80}
              disabled={Boolean(teamAId)}
              className="h-9 disabled:opacity-50"
            />
            <FieldDescription>
              Used only when no registered team is selected.
            </FieldDescription>
          </Field>
        </FieldSet>

        <FieldSet className="rounded-lg border p-4">
          <div>
            <FieldLegend variant="label">Team B</FieldLegend>
            <FieldDescription>
              If the same registered team is selected on both sides, Arbiter
              clears the other side automatically.
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="match-team-b">Registered team</FieldLabel>
            <NativeSelect
              id="match-team-b"
              name="teamBId"
              value={teamBId}
              onChange={(event) => {
                const value = event.target.value;
                setTeamBId(value);
                if (value && value === teamAId) setTeamAId("");
              }}
            >
              <option value="">Use a custom Team B name</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="match-team-b-custom">Custom name</FieldLabel>
            <Input
              id="match-team-b-custom"
              name="teamBName"
              placeholder={
                teamBId ? "Team B linked from roster" : "Custom Team B name"
              }
              maxLength={80}
              disabled={Boolean(teamBId)}
              className="h-9 disabled:opacity-50"
            />
            <FieldDescription>
              Used only when no registered team is selected.
            </FieldDescription>
          </Field>
        </FieldSet>
      </div>

      <FieldSet className="rounded-lg border p-4">
        <div>
          <FieldLegend variant="label">Veto and reporting</FieldLegend>
          <FieldDescription>
            Optional map-pool override and player-facing reporting behavior.
          </FieldDescription>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid gap-4">
            <Field>
              <FieldLabel htmlFor="match-map-pool">Custom map pool</FieldLabel>
              <textarea
                id="match-map-pool"
                name="mapPool"
                placeholder="Optional custom map pool, comma-separated or one per line"
                maxLength={2000}
                className="border-input bg-background min-h-24 rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <FieldDescription>
                Leave empty to use the selected rules preset map pool.
              </FieldDescription>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="match-character-ban-mode">
                  Character ban system
                </FieldLabel>
                <NativeSelect
                  id="match-character-ban-mode"
                  name="characterBanMode"
                  defaultValue="none"
                >
                  <option value="none">No character bans</option>
                  <option value="generic">Generic bans</option>
                  <option value="valorant_protect_ban">Valorant protect + ban</option>
                  <option value="lol_fearless_draft">LoL Fearless locks</option>
                  <option value="owcs_ranked_vote">OWCS ranked hero vote</option>
                  <option value="valorant_agents">Valorant agent bans</option>
                  <option value="lol_champions">LoL champion bans</option>
                  <option value="overwatch_heroes">Overwatch hero bans</option>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="match-character-ban-timer">
                  Character ban timer
                </FieldLabel>
                <Input
                  id="match-character-ban-timer"
                  name="characterBanTimerSeconds"
                  type="number"
                  min={5}
                  max={300}
                  defaultValue={30}
                  className="h-9"
                />
                <FieldDescription>Seconds per hero, agent, or champion ban.</FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="match-character-pool">
                Custom character pool
              </FieldLabel>
              <textarea
                id="match-character-pool"
                name="characterPool"
                placeholder="Optional custom character pool, comma-separated or one per line"
                maxLength={4000}
                className="border-input bg-background min-h-20 rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <FieldDescription>
                Leave empty to use a built-in pool when one exists for the selected
                game.
              </FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="match-player-reports">
              Player reporting
            </FieldLabel>
            <Field
              orientation="horizontal"
              className="min-h-24 rounded-lg border p-3"
            >
              <Checkbox id="match-player-reports" name="allowPlayerReports" />
              <FieldContent>
                <FieldTitle>Player reports</FieldTitle>
                <FieldDescription>
                  Let players submit score reports for referee review.
                </FieldDescription>
              </FieldContent>
            </Field>
            <FieldDescription>
              Referees still approve final scores before they count.
            </FieldDescription>
          </Field>
        </div>
      </FieldSet>

      <div className="flex justify-end border-t pt-4">
        <PendingSubmitButton
          className="w-full sm:w-auto"
          pendingChildren="Creating match..."
        >
          Create match
        </PendingSubmitButton>
      </div>
    </form>
  );
}
