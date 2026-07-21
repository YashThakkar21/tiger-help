"use client";

import { useState } from "react";
import { Badge } from "@/components/ui";
import type { TaDetail } from "@/lib/admin-service";
import { formatMinutes } from "@/lib/time";
import { formatPercent, formatRating, formatNumber } from "@/lib/viz";

// The TA roster as a table, styled like the main queue: one row each, click to
// expand an inline panel of that TA's detail. Metrics are shown side by side and
// never rolled into a single score (design doc §4.3) — handle time in particular
// is ambiguous, so the table presents the whole picture and leaves judgement to
// the admin reading it.
export function TaTable({ tas }: { tas: TaDetail[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[720px] text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-border">
            <th className="py-2.5 px-3">TA</th>
            <th className="py-2.5 px-3 w-20 text-right">Helped</th>
            <th className="py-2.5 px-3 w-24 text-right">Avg time</th>
            <th className="py-2.5 px-3 w-24 text-right">Avg rating</th>
            <th className="py-2.5 px-3 w-24 text-right">No-show</th>
            <th className="py-2.5 px-3 w-20 text-right">Shifts</th>
            <th className="py-2.5 px-3 w-20 text-right">Hours</th>
          </tr>
        </thead>
        <tbody>
          {tas.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-10 text-center text-muted">
                No TA activity in this window yet.
              </td>
            </tr>
          ) : (
            tas.map((ta) => (
              <TaRow
                key={ta.id}
                ta={ta}
                open={openId === ta.id}
                onToggle={() => setOpenId(openId === ta.id ? null : ta.id)}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TaRow({ ta, open, onToggle }: { ta: TaDetail; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        onClick={onToggle}
        aria-expanded={open}
        className={
          "border-b border-border cursor-pointer transition hover:bg-background " +
          (open ? "bg-background" : "")
        }
      >
        <td className="py-2.5 px-3 font-medium whitespace-nowrap">
          <span className="mr-1.5 inline-block text-muted">{open ? "▾" : "▸"}</span>
          {ta.name}
          <span className="ml-2 text-xs text-muted">{ta.netid}</span>
        </td>
        <td className="py-2.5 px-3 text-right tabular-nums">{ta.helped}</td>
        <td className="py-2.5 px-3 text-right tabular-nums">
          {formatMinutes(ta.avgHandleMin != null ? Math.round(ta.avgHandleMin) : null)}
        </td>
        <td className="py-2.5 px-3 text-right tabular-nums">
          {formatRating(ta.avgRating)}
          {ta.ratingCount > 0 && <span className="ml-1 text-xs text-muted">({ta.ratingCount})</span>}
        </td>
        <td className="py-2.5 px-3 text-right tabular-nums">{formatPercent(ta.noShowRate)}</td>
        <td className="py-2.5 px-3 text-right tabular-nums">{ta.shifts}</td>
        <td className="py-2.5 px-3 text-right tabular-nums">{ta.hoursOnShift}</td>
      </tr>

      {open && (
        <tr className="border-b border-border bg-background">
          <td colSpan={7} className="px-4 pb-4 pt-1">
            <TaDetailPanel ta={ta} />
          </td>
        </tr>
      )}
    </>
  );
}

function TaDetailPanel({ ta }: { ta: TaDetail }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        {/* The metric grid — handle time, claim position, etc. together. */}
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Students helped" value={String(ta.helped)} />
          <Metric label="Avg help time" value={formatMinutes(ta.avgHandleMin != null ? Math.round(ta.avgHandleMin) : null)} />
          <Metric label="Avg rating" value={formatRating(ta.avgRating)} sub={`${ta.ratingCount} ratings`} />
          <Metric label="No-show rate" value={formatPercent(ta.noShowRate)} />
          <Metric label="Avg claim position" value={formatNumber(ta.avgClaimPosition)} sub="in FIFO order" />
          <Metric label="Hours on duty" value={String(ta.hoursOnShift)} sub={`${ta.shifts} shifts`} />
        </div>

        {ta.perCourseHelped.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs text-muted">Helped by course</div>
            <div className="flex flex-wrap gap-2">
              {ta.perCourseHelped.map((c) => (
                <Badge key={c.course}>
                  {c.course} · {c.count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Feedback is admin-only — this panel is the only place it surfaces.
            Capped height with its own scroll so a TA with 50 ratings doesn't
            stretch the row to a full screen. */}
        <div>
          <div className="mb-1.5 flex items-baseline gap-1.5 text-xs text-muted">
            <span>Student feedback</span>
            {ta.recentFeedback.length > 0 && (
              <span className="tabular-nums">({ta.recentFeedback.length})</span>
            )}
            <span className="text-muted/70">· admin-only</span>
          </div>
          {ta.recentFeedback.length === 0 ? (
            <p className="text-sm text-muted">No feedback in this window.</p>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {ta.recentFeedback.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="tabular-nums text-accent shrink-0" aria-label={`${f.rating} of 5`}>
                    {"★".repeat(f.rating)}
                    <span className="text-muted">{"★".repeat(5 - f.rating)}</span>
                  </span>
                  {f.comment ? <span>{f.comment}</span> : <span className="text-muted italic">no comment</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline gap-1.5 text-xs text-muted">
          <span>Recent shifts</span>
          {ta.recentShifts.length > 0 && (
            <span className="tabular-nums">({ta.recentShifts.length})</span>
          )}
        </div>
        {ta.recentShifts.length === 0 ? (
          <p className="text-sm text-muted">No shifts in this window.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {ta.recentShifts.map((s, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{formatShiftDate(s.startedAt)}</span>
                  <span className="text-muted">
                    {formatMinutes(s.minutes)}
                    {s.busyness && <span className="ml-2">· {s.busyness.toLowerCase()}</span>}
                  </span>
                </div>
                {s.notes && <p className="mt-1 text-sm text-muted line-clamp-2">{s.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted leading-tight">{label}</div>
      {sub && <div className="text-[10px] text-muted/70">{sub}</div>}
    </div>
  );
}

function formatShiftDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
