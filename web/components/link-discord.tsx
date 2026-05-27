"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { appendAuthNotice } from "@/lib/auth-errors";
import { authClient } from "@/lib/auth-client";

function errorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

function getRedirectUrl(result: unknown) {
  if (!result || typeof result !== "object" || !("data" in result)) return "";
  const data = result.data;
  if (!data || typeof data !== "object" || !("url" in data)) return "";
  return typeof data.url === "string" ? data.url : "";
}

export function LinkDiscordButton({ callbackURL = "/" }: { callbackURL?: string }) {
  const [pending, setPending] = useState(false);

  async function handleLink() {
    setPending(true);
    try {
      const result = await authClient.linkSocial({
        provider: "discord",
        callbackURL,
        scopes: ["identify", "email", "guilds"],
        errorCallbackURL: appendAuthNotice(callbackURL, "discord-link-cancelled"),
      });
      const redirectUrl = getRedirectUrl(result);
      if (redirectUrl) window.location.assign(redirectUrl);
    } catch (error) {
      toast.error(errorMessage(error, "Discord linking could not start."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleLink}
      disabled={pending}
      className="touch-manipulation"
    >
      Link Discord
    </Button>
  );
}
