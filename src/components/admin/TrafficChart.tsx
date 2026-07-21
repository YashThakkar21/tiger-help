import type { TrafficDay, AssignmentDemand } from "@/lib/admin-service";
import { Card, Badge } from "@/components/ui";
import { courseColorVar } from "@/lib/viz";

// Student traffic over time, split by course. Distinct series that all carry
// meaning → categorical color (one fixed hue per course, validated for CVD),
// stacked because the reader also wants the daily total. A legend is always
// present, so identity is never color-alone. A 2px surface gap sits between
// segments (spacing-y on the stack) per the mark spec.
export function TrafficChart({
  days,
  courses,
}: {
  days: TrafficDay[];
  courses: string[];
}) {
  const max = Math.max(1, ...days.map((d) => d.total));

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Student traffic</h2>
        <Legend courses={courses} />
      </div>

      <div className="flex items-end gap-1.5 h-40" role="img" aria-label="Daily tickets by course">
        {days.map((day) => (
          // The column is h-full so the segments' percentage heights resolve
          // against a real height; flex-col-reverse stacks them from the
          // baseline up, with a 2px surface gap (mark spec) between segments.
          <div
            key={day.date}
            className="group relative flex-1 h-full flex flex-col-reverse gap-0.5"
          >
            {courses.map((code) => {
              const count = day.byCourse[code] ?? 0;
              if (!count) return null;
              return (
                <div
                  key={code}
                  className="w-full shrink-0 rounded-[2px]"
                  style={{
                    height: `${(count / max) * 100}%`,
                    backgroundColor: courseColorVar(code),
                  }}
                />
              );
            })}
            {/* Hover detail. */}
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 whitespace-nowrap rounded-lg border border-border bg-surface px-2 py-1 text-xs shadow-lg">
              <div className="font-medium">{day.label} · {day.total}</div>
              {courses.map((c) =>
                day.byCourse[c] ? (
                  <div key={c} className="text-muted">
                    {c}: {day.byCourse[c]}
                  </div>
                ) : null
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Sparse x labels: every few days, so they don't collide. */}
      <div className="flex gap-1.5 text-[10px] text-muted">
        {days.map((day, i) => (
          <div key={day.date} className="flex-1 text-center">
            {i % Math.ceil(days.length / 7) === 0 ? day.label : ""}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Legend({ courses }: { courses: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {courses.map((code) => (
        <span key={code} className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: courseColorVar(code) }}
          />
          {code}
        </span>
      ))}
    </div>
  );
}

// Which assignments drive the most load — the staffing signal. One measure,
// ranked, so this is emphasis (top bar in accent) over a single-hue set rather
// than categorical: the reader compares magnitudes, not identities.
export function AssignmentDemandChart({ data }: { data: AssignmentDemand[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-medium">Top assignments by demand</h2>
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No demand data yet.</p>
      ) : (
        <div className="space-y-1.5">
          {data.map((d, i) => (
            <div key={`${d.course}-${d.assignment}`} className="flex items-center gap-2">
              <div className="w-14 shrink-0">
                <Badge>{d.course}</Badge>
              </div>
              <div className="w-28 shrink-0 truncate text-sm" title={d.assignment}>
                {d.assignment}
              </div>
              <div className="relative h-5 flex-1 rounded bg-background">
                <div
                  className="absolute inset-y-0 left-0 rounded"
                  style={{
                    width: `${(d.count / max) * 100}%`,
                    // Emphasis: the busiest assignment in accent, the rest muted.
                    backgroundColor: i === 0 ? "var(--accent)" : "color-mix(in oklab, var(--accent) 40%, var(--surface))",
                  }}
                />
              </div>
              <div className="w-8 shrink-0 text-right text-sm tabular-nums text-muted">{d.count}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
