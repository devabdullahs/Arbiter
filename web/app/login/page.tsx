"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

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
import { authClient } from "@/lib/auth-client";

const LAST_USED_COOKIE = "better-auth.last_used_login_method";
const EMAIL_METHODS = new Set(["email", "magic-link", "email-otp"]);

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
  const callbackURL = searchParams.get("callbackURL") || "/";
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
    await authClient.signIn.social({ provider: "discord", callbackURL });
    setPending(null);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending("email");
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL,
    });
    setPending(null);
    if (error) {
      toast.error(error.message ?? "Could not send the sign-in link.");
    } else {
      toast.success(
        "Check your email for a sign-in link. (In development it prints to the server console.)",
      );
    }
  }

  async function handlePasskey() {
    setPending("passkey");
    const res = await authClient.signIn.passkey();
    setPending(null);
    if (res?.error) {
      toast.error(
        res.error.message ?? "Passkey sign-in failed or was cancelled.",
      );
      return;
    }
    window.location.href = callbackURL;
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="bg-primary text-primary-foreground mx-auto flex h-10 w-10 items-center justify-center rounded-md font-bold">
            A
          </div>
          <CardTitle className="text-xl">Sign in to Arbiter</CardTitle>
          <CardDescription>Access your org&apos;s referee dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Button
              onClick={handleDiscord}
              disabled={pending !== null}
              className="w-full"
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
                className="w-full"
              >
                Email me a sign-in link
              </Button>
              {emailLastUsed ? <LastUsedPill /> : null}
            </div>
          </form>

          <div className="relative">
            <Button
              variant="outline"
              className="w-full"
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
