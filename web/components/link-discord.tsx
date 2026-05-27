"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { appendAuthNotice } from "@/lib/auth-errors";
import { authClient } from "@/lib/auth-client";

export function LinkDiscordButton({ callbackURL = "/" }: { callbackURL?: string }) {
  const [pending, setPending] = useState(false);

  async function handleLink() {
    setPending(true);
    await authClient.linkSocial({
      provider: "discord",
      callbackURL,
      scopes: ["identify", "email", "guilds"],
      errorCallbackURL: appendAuthNotice(callbackURL, "discord-link-cancelled"),
    });
    setPending(false);
  }

  return (
    <Button onClick={handleLink} disabled={pending}>
      Link Discord
    </Button>
  );
}
