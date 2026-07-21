import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  labStats,
  demandHeatmap,
  dailyTraffic,
  assignmentDemand,
  shiftsOverview,
  taDetail,
  taTable,
} from "@/lib/admin-service";
import { KpiRow, LiveStrip } from "@/components/admin/KpiRow";
import { DemandHeatmap } from "@/components/admin/DemandHeatmap";
import { TrafficChart, AssignmentDemandChart } from "@/components/admin/TrafficChart";
import { ShiftsOverviewCard } from "@/components/admin/ShiftsOverview";
import { TaTable } from "@/components/admin/TaTable";
import { ExportMenu } from "@/components/admin/ExportMenu";

// Admin dashboard: the lab's analytics as a byproduct of the queue. Admin-only,
// enforced here (the whole route) — every read underneath returns feedback and
// per-TA metrics that never appear on a TA-facing surface.

export const dynamic = "force-dynamic";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 28, label: "28 days" },
  { days: 90, label: "Term" },
];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") {
    // TAs and students don't get analytics; send them to the queue.
    redirect("/");
  }

  const { range } = await searchParams;
  const days = RANGES.some((r) => String(r.days) === range) ? Number(range) : 28;

  // All rollups for the window, computed in parallel.
  const [stats, heat, traffic, assignments, shifts, tas] = await Promise.all([
    labStats(days),
    demandHeatmap(days),
    dailyTraffic(Math.min(days, 21)), // the per-day bars stay readable capped at 3 weeks
    assignmentDemand(days),
    shiftsOverview(days),
    taTable(days),
  ]);

  // Full detail for each active TA, so the table can expand without a round-trip.
  const details = (await Promise.all(tas.map((t) => taDetail(t.id, days)))).filter(
    (d): d is NonNullable<typeof d> => d != null
  );

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Lab analytics</h1>
          <p className="mt-0.5 text-xs text-muted">Intro COS labs · 126 / 217 / 226</p>
        </div>
        <div className="flex items-center gap-2">
          <RangePicker current={days} />
          <ExportMenu range={days} />
        </div>
      </div>

      <LiveStrip stats={stats} />
      <KpiRow stats={stats} />

      <DemandHeatmap data={heat} />

      <div className="grid gap-4 lg:grid-cols-2">
        <TrafficChart days={traffic.days} courses={traffic.courses} />
        <AssignmentDemandChart data={assignments} />
      </div>

      <ShiftsOverviewCard data={shifts} />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Teaching assistants</h2>
          <span className="text-xs text-muted">click a row for detail</span>
        </div>
        <TaTable tas={details} />
      </div>
    </div>
  );
}

// Range is a plain link set (a query param), so it works without client JS and
// each range is shareable/bookmarkable.
function RangePicker({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5 text-sm">
      {RANGES.map((r) => {
        const active = r.days === current;
        return (
          <Link
            key={r.days}
            href={`/admin?range=${r.days}`}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-md px-2.5 py-1 transition " +
              (active ? "bg-accent text-accent-fg font-medium" : "text-muted hover:text-foreground")
            }
          >
            {r.label}
          </Link>
        );
      })}
    </div>
  );
}
