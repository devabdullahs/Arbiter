"use client";

import { useMemo, useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import { createWebBrLobbyWithState } from "./actions";

type OrgOption = {
  id: string;
  name: string;
};

type TeamOption = {
  id: string;
  name: string;
  organization: OrgOption;
};

const DEFAULT_PLACEMENT_POINTS = [
  12, 9, 7, 5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0,
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="lg:col-start-6" disabled={pending}>
      {pending ? "Creating" : "Create"}
    </Button>
  );
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function CreateBrLobbyForm({
  orgs,
  teams,
  defaultOrganizationId,
}: {
  orgs: OrgOption[];
  teams: TeamOption[];
  defaultOrganizationId?: string;
}) {
  const [state, formAction] = useActionState(createWebBrLobbyWithState, {});
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [extraTeams, setExtraTeams] = useState<string[]>([""]);
  const [placementPoints, setPlacementPoints] = useState<number[]>(
    DEFAULT_PLACEMENT_POINTS,
  );
  const [clientError, setClientError] = useState("");

  const extraTeamNames = extraTeams.map((name) => name.trim()).filter(Boolean);
  const teamsById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams],
  );
  const { duplicateNames, duplicateKeys } = useMemo(() => {
    const seen = new Set<string>();
    const duplicateKeySet = new Set<string>();
    const duplicates = new Set<string>();

    for (const id of selectedTeamIds) {
      const team = teamsById.get(id);
      if (!team) continue;
      const key = team.name.toLowerCase();
      if (seen.has(key)) {
        duplicateKeySet.add(key);
        duplicates.add(team.name);
      }
      seen.add(key);
    }

    for (const name of extraTeamNames) {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        duplicateKeySet.add(key);
        duplicates.add(name);
      }
      seen.add(key);
    }

    return { duplicateNames: [...duplicates], duplicateKeys: duplicateKeySet };
  }, [extraTeamNames, selectedTeamIds, teamsById]);
  const totalTeams = selectedTeamIds.length + extraTeamNames.length - duplicateNames.length;
  const error =
    clientError ||
    (duplicateNames.length
      ? `Duplicate team name${duplicateNames.length === 1 ? "" : "s"}: ${duplicateNames.join(", ")}.`
      : "") ||
    state.error;

  return (
    <form
      action={formAction}
      className="grid gap-3 lg:grid-cols-6"
      onSubmit={(event) => {
        setClientError("");
        if (duplicateNames.length) {
          event.preventDefault();
          return;
        }
        if (totalTeams < 2) {
          event.preventDefault();
          setClientError("Select or enter at least two teams.");
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
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </NativeSelect>
      <input
        name="name"
        placeholder="Lobby name"
        required
        maxLength={80}
        className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm lg:col-span-2"
      />
      <NativeSelect name="game" defaultValue="Apex Legends">
        <option>Apex Legends</option>
        <option>Fortnite</option>
        <option>PUBG Mobile</option>
        <option>PUBG: Battlegrounds</option>
        <option>Other</option>
      </NativeSelect>
      <input
        name="gamesPlanned"
        type="number"
        min={1}
        max={50}
        defaultValue={6}
        className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
      />
      <input
        name="killPoints"
        type="number"
        min={0}
        max={20}
        defaultValue={1}
        className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
      />
      <input type="hidden" name="teams" value={extraTeamNames.join("\n")} />
      <label className="space-y-1 lg:col-span-2">
        <span className="text-xs font-medium">Registered teams</span>
        <NativeSelect
          name="teamIds"
          multiple
          size={Math.min(12, Math.max(5, teams.length))}
          value={selectedTeamIds}
          onChange={(event) =>
            setSelectedTeamIds(
              Array.from(event.currentTarget.selectedOptions).map(
                (option) => option.value,
              ),
            )
          }
          className="min-h-28"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.organization.name} / {team.name}
            </option>
          ))}
        </NativeSelect>
        <span className="text-muted-foreground block text-xs">
          {totalTeams} unique team{totalTeams === 1 ? "" : "s"} selected.
        </span>
      </label>

      <section className="space-y-3 rounded-lg border p-3 lg:col-span-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Extra teams</h3>
            <p className="text-muted-foreground text-xs">
              Numbered invite teams that are not registered in the organization
              yet. Arbiter keeps this order as their initial seed.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setExtraTeams((items) => [...items, ""])}
          >
            <Plus />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {extraTeams.map((team, index) => {
            const duplicate = duplicateKeys.has(team.trim().toLowerCase());
            return (
              <div
                key={index}
                className="grid grid-cols-[auto_2rem_minmax(0,1fr)_auto] items-center gap-2"
              >
                <GripVertical className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground text-right text-xs tabular-nums">
                  {index + 1}.
                </span>
                <input
                  value={team}
                  onChange={(event) =>
                    setExtraTeams((items) =>
                      items.map((entry, entryIndex) =>
                        entryIndex === index ? event.target.value : entry,
                      ),
                    )
                  }
                  placeholder={`Team ${index + 1}`}
                  maxLength={80}
                  className={cn(
                    "border-input bg-background h-9 rounded-lg border px-2.5 text-sm",
                    duplicate &&
                      "border-destructive focus-visible:ring-destructive/20",
                  )}
                />
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() =>
                      setExtraTeams((items) => moveItem(items, index, -1))
                    }
                    aria-label="Move team up"
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={index === extraTeams.length - 1}
                    onClick={() =>
                      setExtraTeams((items) => moveItem(items, index, 1))
                    }
                    aria-label="Move team down"
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={extraTeams.length === 1 && !team}
                    onClick={() =>
                      setExtraTeams((items) =>
                        items.length === 1
                          ? [""]
                          : items.filter((_, entryIndex) => entryIndex !== index),
                      )
                    }
                    aria-label="Remove team"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-3 lg:col-span-3">
        <input
          type="hidden"
          name="placementPoints"
          value={placementPoints.join(",")}
        />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Placement scoring table</h3>
            <p className="text-muted-foreground text-xs">
              This defines how many points each finishing place is worth. Team
              placement is logged later in each game result.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPlacementPoints((items) => [...items, 0])}
          >
            <Plus />
            Add place
          </Button>
        </div>
        <div className="max-h-72 space-y-2 overflow-auto pr-1">
          {placementPoints.map((points, index) => (
            <div
              key={index}
              className="grid grid-cols-[auto_4.5rem_minmax(0,1fr)_auto] items-center gap-2"
            >
              <GripVertical className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground text-xs tabular-nums">
                Place {index + 1}
              </span>
              <input
                type="number"
                min={0}
                max={999}
                value={points}
                onChange={(event) =>
                  setPlacementPoints((items) =>
                    items.map((entry, entryIndex) =>
                      entryIndex === index
                        ? Number.parseInt(event.target.value || "0", 10)
                        : entry,
                    ),
                  )
                }
                className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() =>
                    setPlacementPoints((items) => moveItem(items, index, -1))
                  }
                  aria-label="Move placement score up"
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={index === placementPoints.length - 1}
                  onClick={() =>
                    setPlacementPoints((items) => moveItem(items, index, 1))
                  }
                  aria-label="Move placement score down"
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={placementPoints.length <= 1}
                  onClick={() =>
                    setPlacementPoints((items) =>
                      items.filter((_, entryIndex) => entryIndex !== index),
                    )
                  }
                  aria-label="Remove placement score"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <SubmitButton />
    </form>
  );
}
