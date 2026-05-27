"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import type { DiscordGuildOption } from "@/lib/discord";

import { createOrganization } from "./actions";

type Props = {
  guilds: DiscordGuildOption[];
  needsReconnect: boolean;
  genericInviteUrl: string;
};

export function CreateOrganizationCard({
  guilds,
  needsReconnect,
  genericInviteUrl,
}: Props) {
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [manualGuildId, setManualGuildId] = useState("");
  const selectedGuild = useMemo(
    () => guilds.find((guild) => guild.id === selectedGuildId) ?? null,
    [guilds, selectedGuildId],
  );
  const effectiveGuildId = selectedGuild?.id ?? manualGuildId.replace(/\D/g, "");
  const inviteUrl = useMemo(() => {
    if (!effectiveGuildId) return genericInviteUrl;
    const url = new URL(genericInviteUrl);
    url.searchParams.set("guild_id", effectiveGuildId);
    url.searchParams.set("disable_guild_select", "true");
    return url.toString();
  }, [effectiveGuildId, genericInviteUrl]);

  return (
    <Card id="create-org">
      <CardHeader>
        <CardTitle className="text-base">Create organization</CardTitle>
        <CardDescription>
          Select a Discord server from your linked account, or enter a server ID
          manually as a fallback. Add the bot before running `/org setup`.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createOrganization} className="space-y-4">
          <input
            type="hidden"
            name="name"
            value={selectedGuild?.name ?? ""}
            readOnly
          />

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
            <div>
              <label htmlFor="create-org-server" className="text-sm font-medium">
                Discord server
              </label>
              <NativeSelect
                id="create-org-server"
                name="selectedGuildId"
                value={selectedGuildId}
                onChange={(event) => setSelectedGuildId(event.target.value)}
                wrapperClassName="mt-1"
              >
                <option value="">
                  {guilds.length > 0
                    ? "Select a server"
                    : "No Discord servers available"}
                </option>
                {guilds.map((guild) => (
                  <option key={guild.id} value={guild.id}>
                    {guild.name}
                    {guild.manageable ? "" : " - missing Manage Server"}
                    {guild.botConfigured ? " - already configured" : " - bot not set up"}
                  </option>
                ))}
              </NativeSelect>
              {needsReconnect ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  Reconnect Discord from Security to grant the `guilds` scope
                  and enable server selection.
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="create-org-guild" className="text-sm font-medium">
                Server ID fallback
              </label>
              {selectedGuild ? (
                <input type="hidden" name="discordGuildId" value={selectedGuild.id} />
              ) : null}
              <input
                id="create-org-guild"
                name={selectedGuild ? undefined : "discordGuildId"}
                value={selectedGuild?.id ?? manualGuildId}
                onChange={(event) => {
                  setManualGuildId(event.target.value);
                  setSelectedGuildId("");
                }}
                required
                disabled={Boolean(selectedGuild)}
                inputMode="numeric"
                placeholder="1393726755046559824"
                className="border-input bg-background mt-1 h-9 w-full rounded-lg border px-2.5 text-sm"
              />
            </div>
          </div>

          {!selectedGuild ? (
            <div>
              <label htmlFor="create-org-name" className="text-sm font-medium">
                Organization name
              </label>
              <input
                id="create-org-name"
                name="manualName"
                required={!selectedGuild}
                placeholder="Saudi Esports League"
                className="border-input bg-background mt-1 h-9 w-full rounded-lg border px-2.5 text-sm"
              />
            </div>
          ) : null}

          {selectedGuild && !selectedGuild.manageable ? (
            <p className="text-muted-foreground text-sm">
              You can see this server, but Discord did not report Manage Server
              or Administrator permission. You may need an organizer to create
              the Arbiter organization.
            </p>
          ) : null}

          {effectiveGuildId ? (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {selectedGuild?.botConfigured
                  ? "Bot is already configured for this server."
                  : "Bot is not configured for this server yet."}
              </p>
              {!selectedGuild?.botConfigured ? (
                <Button asChild variant="outline" className="mt-3">
                  <a href={inviteUrl} target="_blank" rel="noreferrer">
                    Add Bot To Server
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}

          <Button type="submit">Create organization</Button>
        </form>
      </CardContent>
    </Card>
  );
}
