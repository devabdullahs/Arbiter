"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { acceptOrgInvite, type AcceptInviteResult } from "./actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AcceptInviteResult | null>(null);

  return (
    <div className="space-y-3">
      <Button
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setResult(await acceptOrgInvite(token));
          });
        }}
      >
        {pending ? "Accepting..." : "Accept invite"}
      </Button>
      {result ? (
        <p
          className={
            result.ok
              ? "text-sm text-emerald-600 dark:text-emerald-400"
              : "text-destructive text-sm"
          }
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
