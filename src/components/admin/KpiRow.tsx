import type { LabStats } from "@/lib/admin-service";
import { formatMinutes } from "@/lib/time";
import { formatPercent, formatRating } from "@/lib/viz";

// The dashboard's headline numbers. A KPI row of stat tiles, not a chart —
// these are single current values, so the honest form is a big number with a
// quiet label (dataviz: "a handful of headline numbers → KPI row").
export function KpiRow({ stats }: { stats: LabStats }) {
  const tiles: { label: string; value: string; sub?: string; accent?: boolean }[] = [
    { label: "Tickets", value: String(stats.totalTickets), sub: `${stats.uniqueVisitors} students` },
    { label: "Students helped", value: String(stats.studentsHelped), accent: true },
    { label: "Median wait", value: formatMinutes(stats.medianWaitMin != null ? Math.round(stats.medianWaitMin) : null) },
    { label: "Avg help time", value: formatMinutes(stats.avgHandleMin != null ? Math.round(stats.avgHandleMin) : null) },
    { label: "No-show rate", value: formatPercent(stats.noShowRate) },
    {
      label: "Avg rating",
      value: formatRating(stats.avgRating),
      sub: stats.feedbackCount ? `${stats.feedbackCount} ratings` : "no ratings yet",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-border bg-surface px-4 py-3">
          <div className={"text-2xl font-semibold tabular-nums " + (t.accent ? "text-accent" : "")}>
            {t.value}
          </div>
          <div className="mt-0.5 text-xs text-muted">{t.label}</div>
          {t.sub && <div className="mt-1 text-[11px] text-muted/70">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// A compact "right now" strip so an admin glancing at the page sees live state
// without reading the queue itself.
export function LiveStrip({ stats }: { stats: LabStats }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-ok opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
        </span>
        <span className="text-muted">Right now:</span>
      </span>
      <span><span className="font-medium tabular-nums">{stats.liveWaiting}</span> <span className="text-muted">waiting</span></span>
      <span><span className="font-medium tabular-nums">{stats.liveClaimed}</span> <span className="text-muted">in progress</span></span>
      <span><span className="font-medium tabular-nums">{stats.tasOnShiftNow}</span> <span className="text-muted">TAs on shift</span></span>
    </div>
  );
}
