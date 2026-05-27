"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useActionState, useId, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type ExtraTeamSeed = {
  id: string;
  name: string;
};

type PlacementPointRule = {
  id: string;
  points: number;
};

const DEFAULT_PLACEMENT_POINTS = [
  12, 9, 7, 5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0,
];

const INITIAL_EXTRA_TEAMS: ExtraTeamSeed[] = [{ id: "extra-1", name: "" }];

const INITIAL_PLACEMENT_RULES: PlacementPointRule[] =
  DEFAULT_PLACEMENT_POINTS.map((points, index) => ({
    id: `placement-${index + 1}`,
    points,
  }));

let rowIdCounter = 0;

function makeRowId(prefix: string) {
  rowIdCounter += 1;
  return `${prefix}-${Date.now()}-${rowIdCounter}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
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

function ordinal(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function reorderById<T extends { id: string }>(
  items: T[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier | null | undefined,
) {
  if (!overId || activeId === overId) return items;
  const oldIndex = items.findIndex((item) => item.id === activeId);
  const newIndex = items.findIndex((item) => item.id === overId);
  if (oldIndex === -1 || newIndex === -1) return items;
  return arrayMove(items, oldIndex, newIndex);
}

function SortableDragHandle({ id, label }: { id: string; label: string }) {
  const { attributes, listeners } = useSortable({ id });

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:bg-transparent hover:text-foreground cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { isDragging, setNodeRef, transform, transition } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      data-dragging={isDragging}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {children}
    </li>
  );
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
  const sortableSeedListId = useId();
  const sortablePlacementListId = useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [extraTeams, setExtraTeams] =
    useState<ExtraTeamSeed[]>(INITIAL_EXTRA_TEAMS);
  const [placementRules, setPlacementRules] = useState<PlacementPointRule[]>(
    INITIAL_PLACEMENT_RULES,
  );
  const [clientError, setClientError] = useState("");

  const extraTeamNames = extraTeams
    .map((team) => team.name.trim())
    .filter(Boolean);
  const extraTeamIds = useMemo<UniqueIdentifier[]>(
    () => extraTeams.map((team) => team.id),
    [extraTeams],
  );
  const placementRuleIds = useMemo<UniqueIdentifier[]>(
    () => placementRules.map((rule) => rule.id),
    [placementRules],
  );
  const selectedTeamIdSet = useMemo(
    () => new Set(selectedTeamIds),
    [selectedTeamIds],
  );
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
  const totalTeams =
    selectedTeamIds.length + extraTeamNames.length - duplicateNames.length;
  const allRegisteredSelected =
    teams.length > 0 && selectedTeamIds.length === teams.length;
  const registeredSelectionState =
    allRegisteredSelected || (selectedTeamIds.length > 0 && "indeterminate");
  const error =
    clientError ||
    (duplicateNames.length
      ? `Duplicate team name${duplicateNames.length === 1 ? "" : "s"}: ${duplicateNames.join(", ")}.`
      : "") ||
    state.error;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5"
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
        <FieldError className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
          {error}
        </FieldError>
      ) : null}

      <FieldSet className="rounded-lg border bg-muted/20 p-4">
        <div>
          <FieldLegend>Lobby setup</FieldLegend>
          <FieldDescription>
            Configure the lobby basics before selecting linked teams and invite
            seeds.
          </FieldDescription>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Field className="xl:col-span-1">
            <FieldLabel htmlFor="br-organization">Organization</FieldLabel>
            <NativeSelect
              id="br-organization"
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
          <Field className="xl:col-span-2">
            <FieldLabel htmlFor="br-lobby-name">Lobby name</FieldLabel>
            <Input
              id="br-lobby-name"
              name="name"
              placeholder="EWC finals lobby"
              required
              maxLength={80}
              className="h-9"
            />
          </Field>
          <Field className="xl:col-span-1">
            <FieldLabel htmlFor="br-game">Game</FieldLabel>
            <NativeSelect id="br-game" name="game" defaultValue="Apex Legends">
              <option>Apex Legends</option>
              <option>Fortnite</option>
              <option>PUBG Mobile</option>
              <option>PUBG: Battlegrounds</option>
              <option>Other</option>
            </NativeSelect>
          </Field>
          <Field className="xl:col-span-1">
            <FieldLabel htmlFor="br-games-planned">Games</FieldLabel>
            <Input
              id="br-games-planned"
              name="gamesPlanned"
              type="number"
              min={1}
              max={50}
              defaultValue={6}
              className="h-9"
            />
            <FieldDescription>Total games planned.</FieldDescription>
          </Field>
          <Field className="xl:col-span-1">
            <FieldLabel htmlFor="br-kill-points">Kill points</FieldLabel>
            <Input
              id="br-kill-points"
              name="killPoints"
              type="number"
              min={0}
              max={20}
              defaultValue={1}
              className="h-9"
            />
            <FieldDescription>Points per kill.</FieldDescription>
          </Field>
        </div>
      </FieldSet>

      <input type="hidden" name="teams" value={extraTeamNames.join("\n")} />
      {selectedTeamIds.map((teamId) => (
        <input key={teamId} type="hidden" name="teamIds" value={teamId} />
      ))}

      <div className="grid gap-5 xl:grid-cols-2">
        <FieldSet className="rounded-lg border p-4">
          <div>
            <FieldLegend variant="label">Registered teams</FieldLegend>
            <FieldDescription>
              Select roster-linked teams. These stay connected to their team
              records and player memberships.
            </FieldDescription>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      id="br-select-all-teams"
                      name="br-select-all-teams"
                      checked={registeredSelectionState}
                      disabled={teams.length === 0}
                      onCheckedChange={(checked) =>
                        setSelectedTeamIds(
                          checked === true ? teams.map((team) => team.id) : [],
                        )
                      }
                      aria-label="Select all registered teams"
                    />
                  </TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Organization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.length ? (
                  teams.map((team) => {
                    const selected = selectedTeamIdSet.has(team.id);
                    return (
                      <TableRow
                        key={team.id}
                        data-state={selected ? "selected" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            id={`br-team-${team.id}`}
                            name={`br-team-${team.id}`}
                            checked={selected}
                            onCheckedChange={(checked) =>
                              setSelectedTeamIds((current) =>
                                checked === true
                                  ? current.includes(team.id)
                                    ? current
                                    : [...current, team.id]
                                  : current.filter((id) => id !== team.id),
                              )
                            }
                            aria-label={`Select ${team.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{team.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {team.organization.name}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No registered teams yet. Add invite teams on the right.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <FieldDescription>
            {totalTeams} unique team{totalTeams === 1 ? "" : "s"} selected.
          </FieldDescription>
        </FieldSet>

        <FieldSet className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <FieldLegend variant="label">Extra team seeds</FieldLegend>
              <FieldDescription>
                Add invite teams that are not registered yet. Each row is a team
                name, and Arbiter keeps this order as the initial seed.
              </FieldDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setExtraTeams((items) => [
                  ...items,
                  { id: makeRowId("extra"), name: "" },
                ])
              }
            >
              <Plus />
              Add
            </Button>
          </div>
          <FieldDescription>
            Drag the handle or use the arrows to reorder the seed list.
          </FieldDescription>
          <DndContext
            collisionDetection={closestCenter}
            id={sortableSeedListId}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={(event: DragEndEvent) => {
              setExtraTeams((items) =>
                reorderById(items, event.active.id, event.over?.id),
              );
            }}
            sensors={sensors}
          >
            <SortableContext
              items={extraTeamIds}
              strategy={verticalListSortingStrategy}
            >
              <ol className="flex flex-col gap-2">
                {extraTeams.map((team, index) => {
                  const duplicate = duplicateKeys.has(
                    team.name.trim().toLowerCase(),
                  );
                  return (
                    <SortableRow key={team.id} id={team.id}>
                      <div className="grid grid-cols-[auto_4.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md py-1">
                        <SortableDragHandle
                          id={team.id}
                          label={`Drag seed ${index + 1} to reorder`}
                        />
                        <span className="text-muted-foreground text-xs tabular-nums">
                          Seed {index + 1}
                        </span>
                        <Input
                          value={team.name}
                          onChange={(event) =>
                            setExtraTeams((items) =>
                              items.map((entry) =>
                                entry.id === team.id
                                  ? { ...entry, name: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          placeholder="Team name"
                          aria-label={`Seed ${index + 1} team name`}
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
                              setExtraTeams((items) =>
                                moveItem(items, index, -1),
                              )
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
                            disabled={extraTeams.length === 1 && !team.name}
                            onClick={() =>
                              setExtraTeams((items) =>
                                items.length === 1
                                  ? [{ id: team.id, name: "" }]
                                  : items.filter(
                                      (entry) => entry.id !== team.id,
                                    ),
                              )
                            }
                            aria-label="Remove team"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    </SortableRow>
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
        </FieldSet>
      </div>

      <FieldSet className="rounded-lg border p-4">
        <input
          type="hidden"
          name="placementPoints"
          value={placementRules.map((rule) => rule.points).join(",")}
        />
        <div className="flex items-start justify-between gap-3">
          <div>
            <FieldLegend variant="label">Placement point rules</FieldLegend>
            <FieldDescription>
              Scoring rules only. Teams are assigned to 1st, 2nd, 3rd, and so
              on later when you log each game result.
            </FieldDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setPlacementRules((items) => [
                ...items,
                { id: makeRowId("placement"), points: 0 },
              ])
            }
          >
            <Plus />
            Add place
          </Button>
        </div>
        <FieldDescription className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
          Example: if 1st place is 12 and kills are worth 1 point, a team with
          1st place and 5 kills receives 17 points for that game.
        </FieldDescription>
        <DndContext
          collisionDetection={closestCenter}
          id={sortablePlacementListId}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={(event: DragEndEvent) => {
            setPlacementRules((items) =>
              reorderById(items, event.active.id, event.over?.id),
            );
          }}
          sensors={sensors}
        >
          <SortableContext
            items={placementRuleIds}
            strategy={verticalListSortingStrategy}
          >
            <ol className="flex max-h-72 flex-col gap-2 overflow-auto pr-1">
              {placementRules.map((rule, index) => (
                <SortableRow key={rule.id} id={rule.id}>
                  <div className="grid grid-cols-[auto_8rem_minmax(0,1fr)_3rem_auto] items-center gap-2 rounded-md py-1">
                    <SortableDragHandle
                      id={rule.id}
                      label={`Drag ${ordinal(index + 1)} place point rule to reorder`}
                    />
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {ordinal(index + 1)} place
                      </span>
                    <Input
                      type="number"
                      min={0}
                      max={999}
                      value={rule.points}
                      aria-label={`Points for ${ordinal(index + 1)} place`}
                      onChange={(event) =>
                        setPlacementRules((items) =>
                          items.map((entry) =>
                            entry.id === rule.id
                              ? {
                                  ...entry,
                                  points: Number.parseInt(
                                    event.target.value || "0",
                                    10,
                                  ),
                                }
                              : entry,
                          ),
                        )
                      }
                      className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
                    />
                    <span className="text-muted-foreground text-xs">pts</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() =>
                          setPlacementRules((items) =>
                            moveItem(items, index, -1),
                          )
                        }
                        aria-label="Move placement score up"
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={index === placementRules.length - 1}
                        onClick={() =>
                          setPlacementRules((items) => moveItem(items, index, 1))
                        }
                        aria-label="Move placement score down"
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={placementRules.length <= 1}
                        onClick={() =>
                          setPlacementRules((items) =>
                            items.filter((entry) => entry.id !== rule.id),
                          )
                        }
                        aria-label="Remove placement score"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </SortableRow>
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </FieldSet>
      <div className="flex justify-end border-t pt-4">
        <SubmitButton />
      </div>
    </form>
  );
}
