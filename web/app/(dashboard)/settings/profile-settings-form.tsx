"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AtSign,
  BriefcaseBusiness,
  Camera,
  Mail,
  MessageCircle,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { updateUserSettings } from "./actions";
import { FIELD_ROLE_OPTIONS, GAME_OPTIONS } from "./options";

const FALLBACK_COUNTRIES = [
  "SA",
  "AE",
  "BH",
  "KW",
  "QA",
  "OM",
  "EG",
  "JO",
  "US",
  "GB",
  "DE",
  "FR",
  "ES",
  "TR",
  "IN",
  "PK",
  "PH",
  "MY",
];
const intlWithRegions = Intl as typeof Intl & {
  supportedValuesOf?: (key: string) => string[];
};
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRY_OPTIONS = [
  ["", "Select country"],
  ...(
    intlWithRegions.supportedValuesOf?.("region") ?? FALLBACK_COUNTRIES
  )
    .filter((code) => /^[A-Z]{2}$/.test(code))
    .map((code) => [code, regionNames.of(code) ?? code] as [string, string])
    .sort((a, b) => a[1].localeCompare(b[1])),
] as const;

type ProfileSettings = {
  displayName: string;
  countryCode: string;
  bio: string;
  profileVisibility: string;
  openToWork: boolean;
  avatarUrl: string | null;
  contactEmail: string;
  showContactEmail: boolean;
  socialLinks: unknown;
  gameExperiences: string[];
  fieldRoles: string[];
  discordId: string | null;
};

function socialValue(socialLinks: unknown, key: string) {
  if (!socialLinks || typeof socialLinks !== "object") return "";
  const value = (socialLinks as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

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

function SocialInput({
  name,
  label,
  prefix,
  icon: Icon,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  prefix: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="space-y-2">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4" />
        {label}
      </span>
      <div className="border-input bg-background focus-within:border-ring focus-within:ring-ring/50 flex h-9 overflow-hidden rounded-lg border focus-within:ring-3">
        <span className="bg-muted text-muted-foreground hidden items-center border-r px-2 text-xs sm:flex">
          {prefix}
        </span>
        <input
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          maxLength={80}
          className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none"
        />
      </div>
    </label>
  );
}

export function ProfileSettingsForm({ profile }: { profile: ProfileSettings }) {
  const selectedGames = new Set(profile.gameExperiences);
  const selectedRoles = new Set(profile.fieldRoles);
  const [bioLength, setBioLength] = useState(profile.bio.length);

  return (
    <form action={updateUserSettings} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="bg-muted flex size-20 items-center justify-center overflow-hidden rounded-lg border">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-2xl font-semibold">
              {(profile.displayName[0] ?? "A").toUpperCase()}
            </span>
          )}
        </div>
        <label className="space-y-2">
          <span className="text-sm font-medium">Profile picture</span>
          <input
            name="avatar"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="text-sm file:mr-3 file:h-8 file:rounded-lg file:border file:border-input file:bg-background file:px-3 file:text-sm"
          />
          <span className="text-muted-foreground block text-xs">
            PNG, JPG, or WebP. Maximum 2 MB.
          </span>
        </label>
      </div>

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
            {COUNTRY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-medium">Bio</span>
        <textarea
          name="bio"
          defaultValue={profile.bio}
          maxLength={500}
          rows={4}
          placeholder="Briefly describe your event experience, games, languages, and strengths."
          onChange={(event) => setBioLength(event.currentTarget.value.length)}
          className="border-input bg-background min-h-24 w-full resize-y rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <span className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
          <span>Maximum 500 characters.</span>
          <span className="tabular-nums">{bioLength}/500</span>
        </span>
      </label>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Contact and social links</h2>
          <p className="text-muted-foreground text-sm">
            Enter usernames only. Arbiter builds the links automatically.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 sm:col-span-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Mail className="size-4" />
              Public email
            </span>
            <Input
              name="contactEmail"
              type="email"
              defaultValue={profile.contactEmail}
              maxLength={180}
              placeholder="name@example.com"
            />
          </label>
          <label className="flex min-h-20 items-center gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              name="showContactEmail"
              defaultChecked={profile.showContactEmail}
              className="size-4"
            />
            <span>
              <span className="block text-sm font-medium">Show email</span>
              <span className="text-muted-foreground block text-sm">
                Display this email on visible profile pages.
              </span>
            </span>
          </label>
          <label className="flex min-h-20 items-center gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              name="openToWork"
              defaultChecked={profile.openToWork}
              className="size-4"
            />
            <span>
              <span className="block text-sm font-medium">Open to work</span>
              <span className="text-muted-foreground block text-sm">
                Let organization owners find you in worker discovery.
              </span>
            </span>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SocialInput
            name="linkedin"
            label="LinkedIn"
            prefix="linkedin.com/in/"
            icon={BriefcaseBusiness}
            defaultValue={socialValue(profile.socialLinks, "linkedin")}
            placeholder="LinkedIn username"
          />
          <SocialInput
            name="x"
            label="X / Twitter"
            prefix="x.com/"
            icon={AtSign}
            defaultValue={socialValue(profile.socialLinks, "x")}
            placeholder="username"
          />
          <SocialInput
            name="instagram"
            label="Instagram"
            prefix="instagram.com/"
            icon={Camera}
            defaultValue={socialValue(profile.socialLinks, "instagram")}
            placeholder="username"
          />
          <SocialInput
            name="discord"
            label="Discord"
            prefix="discord.com/users/"
            icon={MessageCircle}
            defaultValue={socialValue(profile.socialLinks, "discord")}
            placeholder="username or user ID"
          />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium">Profile visibility</span>
          <select
            name="profileVisibility"
            defaultValue={profile.profileVisibility}
            className="border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="private">Private</option>
            <option value="connections">Connections only</option>
            <option value="public">Public</option>
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
