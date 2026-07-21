import type { ShiftsOverview as Overview } from "@/lib/admin-service";
import { Card } from "@/components/ui";

const BUSY_LABELS: { key: "QUIET" | "STEADY" | "SLAMMED"; label: string; pct: number }[] = [
  // Ordinal (quiet → slammed), so a single-hue ramp at rising intensity — not
  // status colors (slammed isn't an error state).
  { key: "QUIET", label: "Quiet", pct: 30 },
  { key: "STEADY", label: "Steady", pct: 60 },
  { key: "SLAMMED", label: "Slammed", pct: 100 },
];

// TA coverage at a glance: how many shifts, how many hours, and how the shifts
// felt (busyness is the subjective read the event log can't capture).
export function ShiftsOverviewCard({ data }: { data: Overview }) {
  const totalBusy = data.busyness.QUIET + data.busyness.STEADY + data.busyness.SLAMMED;

  return (
    <Card className="space-y-4 p-4">
      <h2 className="text-sm font-medium">TA shifts</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{data.totalShifts}</div>
          <div className="text-xs text-muted">shifts worked</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{data.totalHours}</div>
          <div className="text-xs text-muted">hours on duty</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted">How busy shifts felt</div>
        {totalBusy === 0 ? (
          <p className="text-sm text-muted">No completed shifts yet.</p>
        ) : (
          <>
            {/* One stacked ordinal bar. */}
            <div className="flex h-3 overflow-hidden rounded-full">
              {BUSY_LABELS.map((b) => {
                const n = data.busyness[b.key];
                if (!n) return null;
                return (
                  <div
                    key={b.key}
                    style={{
                      width: `${(n / totalBusy) * 100}%`,
                      backgroundColor: `color-mix(in oklab, var(--accent) ${b.pct}%, var(--surface))`,
                    }}
                    title={`${b.label}: ${n}`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {BUSY_LABELS.map((b) => (
                <span key={b.key} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: `color-mix(in oklab, var(--accent) ${b.pct}%, var(--surface))` }}
                  />
                  {b.label} <span className="tabular-nums">{data.busyness[b.key]}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
