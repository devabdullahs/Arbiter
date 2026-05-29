"use client";

import { useActionState } from "react";

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

import { createTournamentWithState } from "./actions";

type OrgOption = { id: string; name: string };

export function CreateTournamentForm({
  orgs,
  defaultOrganizationId,
}: {
  orgs: OrgOption[];
  defaultOrganizationId?: string;
}) {
  const [state, formAction] = useActionState(createTournamentWithState, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? (
        <FieldError className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2">
          {state.error}
        </FieldError>
      ) : null}

      <FieldSet className="rounded-lg border bg-muted/20 p-4">
        <div>
          <FieldLegend>Tournament setup</FieldLegend>
          <FieldDescription>
            Pick a format, then add seeded teams and generate the bracket.
          </FieldDescription>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Field className="xl:col-span-2">
            <FieldLabel htmlFor="t-organization">Organization</FieldLabel>
            <NativeSelect
              id="t-organization"
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
            <FieldLabel htmlFor="t-name">Name</FieldLabel>
            <Input id="t-name" name="name" placeholder="Spring Invitational" maxLength={120} className="h-9" required />
          </Field>
          <Field className="xl:col-span-2">
            <FieldLabel htmlFor="t-game">Game (optional)</FieldLabel>
            <Input id="t-game" name="gameTitle" placeholder="Valorant" maxLength={80} className="h-9" />
          </Field>
          <Field className="xl:col-span-3">
            <FieldLabel htmlFor="t-format">Format</FieldLabel>
            <NativeSelect id="t-format" name="format" defaultValue="single_elimination">
              <option value="single_elimination">Single elimination</option>
              <option value="double_elimination">Double elimination</option>
              <option value="round_robin">Round robin</option>
            </NativeSelect>
            <FieldDescription>How teams advance through the event.</FieldDescription>
          </Field>
          <Field className="xl:col-span-1">
            <FieldLabel htmlFor="t-best-of">Best of</FieldLabel>
            <Input id="t-best-of" name="bestOf" type="number" min={1} max={99} defaultValue={1} className="h-9" />
            <FieldDescription>Per match.</FieldDescription>
          </Field>
          <Field className="xl:col-span-2">
            <FieldLabel htmlFor="t-third">Extras</FieldLabel>
            <Field orientation="horizontal" className="min-h-9 rounded-lg border p-3">
              <Checkbox id="t-third" name="thirdPlace" />
              <FieldContent>
                <FieldTitle>Third-place match</FieldTitle>
                <FieldDescription>Single elimination only.</FieldDescription>
              </FieldContent>
            </Field>
          </Field>
        </div>
      </FieldSet>

      <div className="flex justify-end border-t pt-4">
        <PendingSubmitButton
          className="w-full sm:w-auto"
          pendingChildren="Creating tournament..."
        >
          Create tournament
        </PendingSubmitButton>
      </div>
    </form>
  );
}
