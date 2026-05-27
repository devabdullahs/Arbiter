"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function LinkDiscordButton({ callbackURL = "/" }: { callbackURL?: string }) {
  const [pending, setPending] = useState(false);

  async function handleLink() {
    setPending(true);
    await authClient.linkSocial({ provider: "discord", callbackURL });
    setPending(false);
  }

  return (
    <Button onClick={handleLink} disabled={pending}>
      Link Discord
    </Button>
  );
}
