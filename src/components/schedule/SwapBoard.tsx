"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import type { ScheduleShift } from "@/lib/schedule-service";
import { dayLabel, timeLabel } from "@/lib/schedule-week";

// The swap board: every upcoming shift that needs covering. A TA who's out
// drops their shift here (from the calendar), and anyone can pick one up. Shown
// as a list, not a calendar, because "what can I grab?" is a scan-and-act task.
export function SwapBoard({
  shifts,
  onCover,
}: {
  shifts: ScheduleShift[];
  onCover: (id: string) => Promise<string | null>;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Open shifts · needs coverage</h2>
        <span className="text-xs text-muted">{shifts.length} open</span>
      </div>

      {shifts.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">
          Nothing to cover right now. When a TA gives up a shift, it shows here.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {shifts.map((s) => (
            <SwapRow key={s.id} shift={s} onCover={onCover} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SwapRow({
  shift,
  onCover,
}: {
  shift: ScheduleShift;
  onCover: (id: string) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cover() {
    setBusy(true);
    setError(null);
    const err = await onCover(shift.id);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{shift.title}</span>
          <Badge>{shift.location}</Badge>
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {dayLabel(new Date(shift.startsAt))} · {timeLabel(shift.startsAt)}–{timeLabel(shift.endsAt)}
          {shift.droppedByName && (
            <span className="ml-1.5">· {shift.droppedByName} is out</span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
      {shift.isMine ? (
        // Edge case: you dropped it, nobody's covered yet — reclaiming is just
        // covering your own open shift.
        <Button variant="ghost" onClick={cover} disabled={busy}>
          {busy ? "…" : "Take it back"}
        </Button>
      ) : (
        <Button onClick={cover} disabled={busy}>
          {busy ? "Covering…" : "Cover shift"}
        </Button>
      )}
    </li>
  );
}
