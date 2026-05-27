"use client";

import { useMemo, useState, useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating" : "Create"}
    </Button>
  );
}

export function CreateMatchForm({
  orgs,
  teams,
  defaultOrganizationId,
}: {
  orgs: OrgOption[];
  teams: TeamOption[];
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
      className="grid gap-3 lg:grid-cols-6"
      onSubmit={(event) => {
        setClientError("");
        if (teamAId && teamBId && teamAId === teamBId) {
          event.preventDefault();
          setClientError("Select two different teams.");
        }
      }}
    >
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive lg:col-span-6">
          {error}
        </p>
      ) : null}
      <NativeSelect
        name="organizationId"
        defaultValue={defaultOrganizationId}
        wrapperClassName="lg:col-span-2"
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        name="teamAId"
        value={teamAId}
        onChange={(event) => {
          const value = event.target.value;
          setTeamAId(value);
          if (value && value === teamBId) setTeamBId("");
        }}
        wrapperClassName="lg:col-span-2"
      >
        <option value="">Team A: custom name</option>
        {teamOptions.map((team) => (
          <option key={team.id} value={team.id}>
            {team.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        name="teamBId"
        value={teamBId}
        onChange={(event) => {
          const value = event.target.value;
          setTeamBId(value);
          if (value && value === teamAId) setTeamAId("");
        }}
        wrapperClassName="lg:col-span-2"
      >
        <option value="">Team B: custom name</option>
        {teamOptions.map((team) => (
          <option key={team.id} value={team.id}>
            {team.label}
          </option>
        ))}
      </NativeSelect>
      <input
        name="teamAName"
        placeholder={teamAId ? "Team A linked from roster" : "Custom Team A name"}
        maxLength={80}
        disabled={Boolean(teamAId)}
        className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm disabled:opacity-50 lg:col-span-2"
      />
      <input
        name="teamBName"
        placeholder={teamBId ? "Team B linked from roster" : "Custom Team B name"}
        maxLength={80}
        disabled={Boolean(teamBId)}
        className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm disabled:opacity-50 lg:col-span-2"
      />
      <input
        name="bestOf"
        type="number"
        min={1}
        max={99}
        defaultValue={3}
        className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
      />
      <NativeSelect name="rulesPreset" defaultValue="generic">
        <option value="generic">Generic</option>
        <option value="valorant">Valorant</option>
        <option value="overwatch">Overwatch</option>
        <option value="r6s">Rainbow Six Siege</option>
        <option value="cod">Call of Duty</option>
        <option value="rocket_league">Rocket League</option>
      </NativeSelect>
      <SubmitButton />
      <textarea
        name="mapPool"
        placeholder="Optional custom map pool, comma-separated or one per line"
        maxLength={2000}
        className="border-input bg-background min-h-20 rounded-lg border px-2.5 py-2 text-sm lg:col-span-4"
      />
      <NativeSelect name="vetoMode" defaultValue="series_picks">
        <option value="series_picks">Series picks</option>
        <option value="final_map_ban">Final map ban</option>
        <option value="manual_picks">Manual picks</option>
      </NativeSelect>
      <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
        <input type="checkbox" name="allowPlayerReports" />
        Player reports
      </label>
    </form>
  );
}
