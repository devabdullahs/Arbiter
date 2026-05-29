"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function VetoCountdown({
  durationSeconds,
  startedAt,
  complete = false,
}: {
  durationSeconds: number;
  startedAt: string | null;
  complete?: boolean;
}) {
  const safeDuration = Math.max(1, durationSeconds);
  const startedAtMs = useMemo(
    () => (startedAt ? new Date(startedAt).getTime() : null),
    [startedAt],
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAtMs || complete) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [complete, startedAtMs]);

  if (complete) {
    return (
      <TimerFrame label="Timer" value="Complete" progress={100} tone="complete" />
    );
  }

  if (!startedAtMs) {
    return (
      <TimerFrame
        label="Timer"
        value={`${safeDuration}s ready`}
        progress={100}
        tone="idle"
      />
    );
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - startedAtMs) / 1_000));
  const remainingSeconds = Math.max(0, safeDuration - elapsedSeconds);
  const progress = Math.max(0, Math.min(100, (remainingSeconds / safeDuration) * 100));
  const tone =
    remainingSeconds <= 0
      ? "expired"
      : remainingSeconds <= 10 || progress <= 15
        ? "danger"
        : remainingSeconds <= 20 || progress <= 35
          ? "warning"
          : "active";

  return (
    <TimerFrame
      label={remainingSeconds <= 0 ? "Turn expired" : "Time left"}
      value={remainingSeconds <= 0 ? "0:00" : formatSeconds(remainingSeconds)}
      progress={progress}
      tone={tone}
    />
  );
}

function TimerFrame({
  label,
  value,
  progress,
  tone,
}: {
  label: string;
  value: string;
  progress: number;
  tone: "active" | "warning" | "danger" | "expired" | "idle" | "complete";
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">{label}</p>
        <Badge
          variant={tone === "danger" || tone === "expired" ? "destructive" : "outline"}
        >
          {value}
        </Badge>
      </div>
      <Progress
        value={progress}
        aria-label={`${label}: ${value}`}
        className={cn(
          "h-2",
          tone === "warning" && "[&_[data-slot=progress-indicator]]:bg-chart-2",
          (tone === "danger" || tone === "expired") &&
            "[&_[data-slot=progress-indicator]]:bg-destructive",
          tone === "complete" &&
            "[&_[data-slot=progress-indicator]]:bg-chart-1",
        )}
      />
    </div>
  );
}
