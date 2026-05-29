"use client";

import { useEffect, useRef } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function MatchLiveSync({
  code,
  version,
}: {
  code: string;
  version: string;
}) {
  const router = useRouter();
  const currentVersion = useRef(version);

  useEffect(() => {
    currentVersion.current = version;
  }, [version]);

  useEffect(() => {
    const source = new EventSource(`/api/matches/${code}/events`);

    source.addEventListener("match", (event) => {
      const raw = event instanceof MessageEvent ? event.data : "";
      let nextVersion = raw;
      let alert: string | null = null;
      try {
        const parsed = JSON.parse(raw) as { version?: string; alert?: string };
        nextVersion = parsed.version ?? raw;
        alert = parsed.alert ?? null;
      } catch {
        nextVersion = raw;
      }
      if (nextVersion && nextVersion !== currentVersion.current) {
        currentVersion.current = nextVersion;
        if (alert) toast.info(alert);
        router.refresh();
      }
    });

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [code, router]);

  return null;
}
