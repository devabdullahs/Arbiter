"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  appendAuthNotice,
  authNoticeFromParams,
  friendlyPasskeyError,
} from "@/lib/auth-errors";
import { authClient } from "@/lib/auth-client";

import { markPasskeyUsed } from "./actions";

const LAST_USED_COOKIE = "better-auth.last_used_login_method";
const EMAIL_METHODS = new Set(["email", "magic-link", "email-otp"]);

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

function LastUsedPill() {
  return (
    <span className="bg-background text-muted-foreground pointer-events-none absolute -top-2 right-3 rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm">
      Last used
    </span>
  );
}

function readLastUsedMethod(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${LAST_USED_COOKIE}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function LoginCard() {
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") || "/dashboard";
  const authNotice = authNoticeFromParams(searchParams);
  const [email, setEmail] = useState("");
  const [lastUsed] = useState<string | null>(() => readLastUsedMethod());
  const [pending, setPending] = useState<
    "discord" | "email" | "passkey" | null
  >(null);

  const discordLastUsed = lastUsed === "discord";
  const emailLastUsed = lastUsed ? EMAIL_METHODS.has(lastUsed) : false;
  const passkeyLastUsed = lastUsed === "passkey";

  async function handleDiscord() {
    setPending("discord");
    try {
      const result = await authClient.signIn.social({
        provider: "discord",
        callbackURL,
        scopes: ["identify", "email", "guilds"],
        errorCallbackURL: appendAuthNotice(
          `/login?callbackURL=${encodeURIComponent(callbackURL)}`,
          "discord-signin-cancelled",
        ),
      });
      const redirectUrl = getRedirectUrl(result);
      if (redirectUrl) window.location.assign(redirectUrl);
    } catch (error) {
      toast.error(errorMessage(error, "Discord sign-in could not start."));
    } finally {
      setPending(null);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending("email");
    try {
      const { error } = await authClient.signIn.magicLink({
        email,
        callbackURL,
      });
      if (error) {
        toast.error(error.message ?? "Could not send the sign-in link.");
      } else {
        toast.success(
          "Check your email for a sign-in link. (In development it prints to the server console.)",
        );
      }
    } catch (error) {
      toast.error(errorMessage(error, "Could not send the sign-in link."));
    } finally {
      setPending(null);
    }
  }

  async function handlePasskey() {
    setPending("passkey");
    try {
      const res = await authClient.signIn.passkey({
        returnWebAuthnResponse: true,
      });
      if (res?.error) {
        toast.error(friendlyPasskeyError(res.error.message, "sign-in"));
        return;
      }
      if (res && typeof res === "object" && "webauthn" in res) {
        await markPasskeyUsed(res.webauthn.response.id);
      }
      window.location.href = callbackURL;
    } catch (error) {
      toast.error(friendlyPasskeyError(errorMessage(error, ""), "sign-in"));
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ModeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="bg-primary text-primary-foreground mx-auto flex h-10 w-10 items-center justify-center rounded-md font-bold">
            A
          </div>
          <CardTitle className="text-xl">Sign in to Arbiter</CardTitle>
          <CardDescription>Access your org&apos;s referee dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {authNotice ? (
            <div className="border-border bg-muted/50 rounded-md border px-3 py-2 text-sm">
              <p className="font-medium">{authNotice.title}</p>
              <p className="text-muted-foreground">{authNotice.description}</p>
            </div>
          ) : null}

          <div className="relative">
            <Button
              type="button"
              onClick={handleDiscord}
              disabled={pending !== null}
              className="w-full touch-manipulation"
              variant="outline"
            >
              Continue with Discord
            </Button>
            {discordLastUsed ? <LastUsedPill /> : null}
          </div>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleMagicLink} className="space-y-2">
            <Input
              type="email"
              placeholder="you@org.gg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <div className="relative">
              <Button
                type="submit"
                disabled={pending !== null}
                className="w-full touch-manipulation"
              >
                Email me a sign-in link
              </Button>
              {emailLastUsed ? <LastUsedPill /> : null}
            </div>
          </form>

          <div className="relative">
            <Button
              type="button"
              variant="outline"
              className="w-full touch-manipulation"
              onClick={handlePasskey}
              disabled={pending !== null}
            >
              Sign in with a passkey
            </Button>
            {passkeyLastUsed ? <LastUsedPill /> : null}
          </div>

          <p className="text-muted-foreground text-center text-xs">
            Email sign-in works on its own, but org data unlocks once you link
            your Discord account.
          </p>
          <p className="text-center text-xs">
            <Link href="/about" className="text-primary hover:underline">
              Learn about Arbiter
            </Link>
          </p>
          <p className="text-muted-foreground text-center text-xs">
            <Link href="/privacy" className="hover:text-foreground hover:underline">
              Privacy
            </Link>
            {" / "}
            <Link href="/terms" className="hover:text-foreground hover:underline">
              Terms
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-svh items-center justify-center p-4" />}>
      <LoginCard />
    </Suspense>
  );
}
