"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button, Badge } from "@/components/ui";
import { WeekCalendar } from "@/components/schedule/WeekCalendar";
import { SwapBoard } from "@/components/schedule/SwapBoard";
import type { ScheduleShift } from "@/lib/schedule-service";
import {
  weekStart,
  weekParam,
  parseWeekParam,
  addDays,
  weekRangeLabel,
  dayLabel,
  timeLabel,
} from "@/lib/schedule-week";

type ScheduleData = {
  viewerId: string;
  weekStart: string;
  myShifts: ScheduleShift[];
  openShifts: ScheduleShift[];
  upcoming: ScheduleShift[];
};

// The TA schedule page: a weekly calendar of my own shifts, my next few shifts
// at a glance, and the swap board. Week navigation and the drop/cover actions
// all refetch from one endpoint, so the calendar and board never disagree.
export function ScheduleScreen() {
  const [week, setWeek] = useState<string>(() => weekParam(weekStart(new Date())));
  const [data, setData] = useState<ScheduleData | null>(null);
  const [selected, setSelected] = useState<ScheduleShift | null>(null);

  const refetch = useCallback(async (w: string) => {
    const r = await fetch(`/api/schedule?week=${w}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, []);

  useEffect(() => {
    refetch(week);
  }, [week, refetch]);

  const monday = parseWeekParam(week);

  async function drop(id: string): Promise<string | null> {
    const r = await fetch(`/api/schedule/${id}/drop`, { method: "POST" });
    if (!r.ok) return (await r.json()).error ?? "Could not give up the shift.";
    await refetch(week);
    return null;
  }

  async function cover(id: string): Promise<string | null> {
    const r = await fetch(`/api/schedule/${id}/cover`, { method: "POST" });
    if (!r.ok) return (await r.json()).error ?? "Could not cover the shift.";
    await refetch(week);
    return null;
  }

  if (!data) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My schedule</h1>
          <p className="mt-0.5 text-xs text-muted">{weekRangeLabel(monday)}</p>
        </div>
        <WeekNav
          onPrev={() => setWeek(weekParam(addDays(monday, -7)))}
          onToday={() => setWeek(weekParam(weekStart(new Date())))}
          onNext={() => setWeek(weekParam(addDays(monday, 7)))}
        />
      </div>

      {data.upcoming.length > 0 && <UpcomingStrip shifts={data.upcoming} />}

      <WeekCalendar monday={monday} shifts={data.myShifts} onSelect={setSelected} />

      <SwapBoard shifts={data.openShifts} onCover={cover} />

      {selected && (
        <ShiftDetailModal
          shift={selected}
          onClose={() => setSelected(null)}
          onDrop={async () => {
            const err = await drop(selected.id);
            if (!err) setSelected(null);
            return err;
          }}
        />
      )}
    </div>
  );
}

function WeekNav({
  onPrev,
  onToday,
  onNext,
}: {
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
}) {
  const btn = "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm transition hover:bg-background";
  return (
    <div className="flex items-center gap-2">
      <button onClick={onPrev} className={btn} aria-label="Previous week">←</button>
      <button onClick={onToday} className={btn}>This week</button>
      <button onClick={onNext} className={btn} aria-label="Next week">→</button>
    </div>
  );
}

function UpcomingStrip({ shifts }: { shifts: ScheduleShift[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="mb-2 text-xs text-muted">Your next shifts</div>
      <div className="flex flex-wrap gap-2">
        {shifts.map((s) => (
          <div key={s.id} className="rounded-lg border border-border px-3 py-1.5 text-xs">
            <span className="font-medium">{dayLabel(new Date(s.startsAt))}</span>
            <span className="text-muted"> · {timeLabel(s.startsAt)} · {s.location}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShiftDetailModal({
  shift,
  onClose,
  onDrop,
}: {
  shift: ScheduleShift;
  onClose: () => void;
  onDrop: () => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const past = new Date(shift.endsAt) <= new Date();

  async function drop() {
    if (!confirm("Give up this shift? It goes on the swap board for another TA to cover.")) return;
    setBusy(true);
    setError(null);
    const err = await onDrop();
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Modal title={shift.title} onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-muted">When: </span>
            {dayLabel(new Date(shift.startsAt))} · {timeLabel(shift.startsAt)}–{timeLabel(shift.endsAt)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted">Where: </span>
            <Badge>{shift.location}</Badge>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {past ? (
          <p className="text-xs text-muted">This shift has already passed.</p>
        ) : (
          <div className="flex gap-2">
            <Button variant="danger" onClick={drop} disabled={busy}>
              {busy ? "Giving up…" : "Give up / request swap"}
            </Button>
            <Button variant="ghost" onClick={onClose}>Keep it</Button>
          </div>
        )}
        {!past && (
          <p className="text-xs text-muted">
            Giving it up puts it on the swap board — another TA can then cover it.
          </p>
        )}
      </div>
    </Modal>
  );
}
