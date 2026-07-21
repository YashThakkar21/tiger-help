"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { EndShiftModal } from "@/components/EndShiftModal";
import { formatMinutes } from "@/lib/time";
import { shiftMinutes } from "@/lib/shifts";

type MyShift = { id: string; startedAt: string } | null;

// The TA's on/off-duty control, above the queue. Off shift: a single "Start
// shift" button. On shift: a live running timer and "End shift", which opens
// the wrap-up. Shift state is owned by the queue view (myShift), so this
// component just reflects it and reports changes up via onChange.
export function ShiftBar({ myShift, onChange }: { myShift: MyShift; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEnd, setShowEnd] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/shifts/start", { method: "POST" });
    setBusy(false);
    if (!r.ok) {
      setError((await r.json()).error ?? "Could not start your shift.");
      return;
    }
    onChange();
  }

  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {myShift ? (
          <>
            <ShiftClock startedAt={myShift.startedAt} />
            <Button variant="ghost" onClick={() => setShowEnd(true)}>
              End shift
            </Button>
          </>
        ) : (
          <>
            <div className="text-sm text-muted">You&rsquo;re off shift.</div>
            <Button onClick={start} disabled={busy}>
              {busy ? "Starting…" : "Start shift"}
            </Button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {showEnd && (
        <EndShiftModal
          onClose={() => setShowEnd(false)}
          onEnded={() => {
            setShowEnd(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}

// A quietly ticking "on shift for 1h 12m". Recomputed every 30s — a shift
// timer doesn't need second precision, and the SSE nudge already refreshes the
// rest of the page.
function ShiftClock({ startedAt }: { startedAt: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-ok opacity-60 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
      </span>
      <span className="font-medium">On shift</span>
      <span className="text-muted">· {formatMinutes(shiftMinutes(startedAt))}</span>
    </div>
  );
}
