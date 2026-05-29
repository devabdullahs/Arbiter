"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Quick-jump: type a match code (e.g. from Discord or a referee) and open it.
// Makes it obvious that a code is a way *into* a match, not just a label.
export function OpenMatchByCode({ className }: { className?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/matches/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex items-center gap-2", className)}
    >
      <Input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Match code"
        aria-label="Enter a match code to open it"
        maxLength={16}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        className="h-9 w-36 font-mono uppercase"
      />
      <Button type="submit" variant="outline" className="h-9 shrink-0">
        Open
        <ArrowRight className="ml-1 size-4" />
      </Button>
    </form>
  );
}
