"use client";

import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { updateUserSettings } from "./actions";
import { FIELD_ROLE_OPTIONS, GAME_OPTIONS } from "./options";

const COUNTRIES = [
  ["", "Select country"],
  ["SA", "Saudi Arabia"],
  ["AE", "United Arab Emirates"],
  ["BH", "Bahrain"],
  ["KW", "Kuwait"],
  ["QA", "Qatar"],
  ["OM", "Oman"],
  ["EG", "Egypt"],
  ["JO", "Jordan"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["ES", "Spain"],
  ["TR", "Turkey"],
  ["IN", "India"],
  ["PK", "Pakistan"],
  ["PH", "Philippines"],
  ["MY", "Malaysia"],
  ["OTHER", "Other"],
] as const;

type ProfileSettings = {
  displayName: string;
  countryCode: string;
  gameExperiences: string[];
  fieldRoles: string[];
  discordId: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
      <Save />
      {pending ? "Saving" : "Save settings"}
    </Button>
  );
}

function CheckboxPill({
  name,
  value,
  checked,
}: {
  name: string;
  value: string;
  checked: boolean;
}) {
  return (
    <label className="has-checked:border-primary has-checked:bg-primary/10 flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={checked}
        className="size-4"
      />
      <span>{value}</span>
    </label>
  );
}

export function ProfileSettingsForm({ profile }: { profile: ProfileSettings }) {
  const selectedGames = new Set(profile.gameExperiences);
  const selectedRoles = new Set(profile.fieldRoles);

  return (
    <form action={updateUserSettings} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium">Display name</span>
          <Input
            name="displayName"
            defaultValue={profile.displayName}
            maxLength={80}
            required
            autoComplete="name"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Country</span>
          <select
            name="countryCode"
            defaultValue={profile.countryCode}
            className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {COUNTRIES.map(([value, label]) => (
              <option key={value} value={value === "OTHER" ? "" : value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Games you can work</h2>
          <p className="text-muted-foreground text-sm">
            Used later for faster shift assignment and filtering.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_OPTIONS.map((game) => (
            <CheckboxPill
              key={game}
              name="gameExperiences"
              value={game}
              checked={selectedGames.has(game)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Field role</h2>
          <p className="text-muted-foreground text-sm">
            Pick every role you can realistically cover during an event.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FIELD_ROLE_OPTIONS.map((role) => (
            <CheckboxPill
              key={role}
              name="fieldRoles"
              value={role}
              checked={selectedRoles.has(role)}
            />
          ))}
        </div>
      </section>

      {!profile.discordId ? (
        <p className="text-muted-foreground text-sm">
          Link Discord from Security to sync these profile details with your
          referee identity.
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
