"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveRefetch } from "@/hooks/useLiveRefetch";
import { QueueTable } from "@/components/QueueTable";
import type { Entry } from "@/lib/queue-types";
import { JoinModal } from "@/components/JoinModal";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ShiftBar } from "@/components/ShiftBar";
import { formatMinutes } from "@/lib/time";

type QueueData = {
  role: string;
  stats: {
    waiting: number;
    claimed: number;
    avgHandleMinutes: number | null;
    tasOnShift: number;
  };
  myShift: { id: string; startedAt: string } | null;
  myActiveId: string | null;
  myClaimedId: string | null;
  pendingFeedback: {
    ticketId: string;
    summary: string;
    courseCode: string;
    claimedByName: string | null;
  } | null;
  tickets: Entry[];
};

// The single central queue, shared by students and TAs. Same list for everyone;
// the difference is only what each role can DO with an entry (see QueueCard).
export function QueueScreen({ role, userName }: { role: string; userName: string }) {
  const [data, setData] = useState<QueueData | null>(null);
  const [showJoin, setShowJoin] = useState(false);

  const refetch = useCallback(async () => {
    const r = await fetch("/api/queue", { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useLiveRefetch(refetch);

  if (!data) return <p className="text-sm text-muted">Loading…</p>;

  const isStudent = role === "STUDENT";
  const isStaff = role === "TA" || role === "ADMIN";
  // Can join only when signed in as a student, with no active ticket and no
  // pending feedback (the feedback prompt must be cleared first).
  const canJoin = isStudent && !data.myActiveId && !data.pendingFeedback;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Help queue</h1>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-ok opacity-60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            Live
          </span>
        </div>
        <p className="text-xs text-muted">{userName}</p>
      </div>

      {/* TAs manage their own on/off-shift state right above the queue. */}
      {isStaff && <ShiftBar myShift={data.myShift} onChange={refetch} />}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Waiting" value={String(data.stats.waiting)} accent />
        <StatTile label="In progress" value={String(data.stats.claimed)} />
        <StatTile label="TAs on shift" value={String(data.stats.tasOnShift)} />
        <StatTile
          label="Avg help time"
          value={formatMinutes(
            data.stats.avgHandleMinutes != null
              ? Math.round(data.stats.avgHandleMinutes)
              : null
          )}
        />
      </div>

      <QueueTable
        tickets={data.tickets}
        role={role}
        myClaimedId={data.myClaimedId}
        onShift={!!data.myShift}
        onChange={refetch}
      />

      {canJoin && data.tickets.length === 0 && (
        <p className="text-sm text-muted text-center">Tap the + button to add yourself.</p>
      )}

      {/* + sign-up button for students without an active ticket. */}
      {canJoin && (
        <button
          onClick={() => setShowJoin(true)}
          aria-label="Join the queue"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-accent text-accent-fg px-5 py-3 shadow-lg hover:opacity-90 transition font-medium"
        >
          <span className="text-xl leading-none">+</span> Join the queue
        </button>
      )}

      {showJoin && (
        <JoinModal
          onClose={() => setShowJoin(false)}
          onJoined={() => {
            setShowJoin(false);
            refetch();
          }}
        />
      )}

      {/* Mandatory feedback after being helped — blocks the screen until done. */}
      {data.pendingFeedback && (
        <FeedbackModal pending={data.pendingFeedback} onDone={refetch} />
      )}
    </div>
  );
}

// Compact KPI tile: a magnitude with a quiet label. The number wears ink tokens
// (the primary "Waiting" metric gets the accent as the page's one warm highlight).
function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className={"text-2xl font-semibold tabular-nums " + (accent ? "text-accent" : "")}>
        {value}
      </div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}
