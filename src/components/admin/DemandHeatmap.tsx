import type { Heatmap } from "@/lib/admin-service";
import { Card } from "@/components/ui";
import { heatColor, heatTextColor, formatHour } from "@/lib/viz";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// When students ask for help, as a weekday × hour grid — the demand map the
// design doc leads with. Magnitude on a grid → a sequential single-hue heatmap
// (the brand accent, light→dark). Counts are printed in the cells, which also
// satisfies the contrast "relief" rule for the faint low-end steps.
export function DemandHeatmap({ data }: { data: Heatmap }) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Demand by day &amp; hour</h2>
        <span className="text-xs text-muted">{data.total} tickets</span>
      </div>

      {data.total === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No demand data in this window yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0.5 text-xs">
            <thead>
              <tr>
                <th className="w-9" />
                {data.hours.map((h) => (
                  <th key={h} className="px-0.5 pb-1 text-center font-normal text-muted whitespace-nowrap">
                    {formatHour(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DOW.map((label, row) => (
                <tr key={label}>
                  <td className="pr-2 text-right text-muted whitespace-nowrap">{label}</td>
                  {data.hours.map((h) => {
                    const count = data.grid[row][h];
                    const intensity = data.max ? count / data.max : 0;
                    return (
                      <td
                        key={h}
                        title={`${label} ${formatHour(h)} · ${count} ticket${count === 1 ? "" : "s"}`}
                        className="h-8 w-8 rounded text-center align-middle tabular-nums"
                        style={{
                          backgroundColor: heatColor(intensity),
                          color: count ? heatTextColor(intensity) : "transparent",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {count || ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <HeatLegend max={data.max} />
    </Card>
  );
}

function HeatLegend({ max }: { max: number }) {
  if (max === 0) return null;
  const steps = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span>Fewer</span>
      <div className="flex gap-0.5">
        {steps.map((s) => (
          <span
            key={s}
            className="h-3 w-5 rounded-sm"
            style={{ backgroundColor: heatColor(s), border: "1px solid var(--border)" }}
          />
        ))}
      </div>
      <span>More</span>
      <span className="ml-1">· up to {max}/hr</span>
    </div>
  );
}
