"use client";

import type { ScheduleShift } from "@/lib/schedule-service";
import {
  addDays,
  shortDay,
  timeLabel,
  isSameDay,
  hoursIntoDay,
} from "@/lib/schedule-week";

const ROW_H = 46; // px per hour

// A week time-grid of the signed-in TA's own shifts — the "calendar view".
// Seven day columns, an hour band derived from the shifts in view (evening by
// default, widened if a shift falls outside it). Shift blocks are positioned by
// their start/end within the band; clicking one opens its detail + swap action.
export function WeekCalendar({
  monday,
  shifts,
  onSelect,
}: {
  monday: Date;
  shifts: ScheduleShift[];
  onSelect: (shift: ScheduleShift) => void;
}) {
  const startHours = shifts.map((s) => Math.floor(hoursIntoDay(s.startsAt)));
  const endHours = shifts.map((s) => Math.ceil(hoursIntoDay(s.endsAt)));
  const bandStart = Math.max(7, Math.min(16, ...startHours));
  const bandEnd = Math.min(24, Math.max(22, ...endHours));
  const hours = Array.from({ length: bandEnd - bandStart }, (_, i) => bandStart + i);
  const bodyH = (bandEnd - bandStart) * ROW_H;

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const today = new Date();

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <div className="min-w-[680px]">
        {/* Day headers */}
        <div className="flex border-b border-border">
          <div className="w-12 shrink-0" />
          {days.map((d, i) => {
            const isToday = isSameDay(d, today);
            return (
              <div
                key={i}
                className={
                  "flex-1 px-2 py-2 text-center text-xs " +
                  (isToday ? "bg-accent/5" : "")
                }
              >
                <div className={isToday ? "font-medium text-accent" : "text-muted"}>
                  {shortDay(d)}
                </div>
                <div className={"text-sm " + (isToday ? "font-semibold text-accent" : "")}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="flex" style={{ height: bodyH }}>
          {/* Hour gutter */}
          <div className="w-12 shrink-0 relative">
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted"
                style={{ top: i * ROW_H }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, di) => {
            const isToday = isSameDay(day, today);
            const dayShifts = shifts.filter((s) => isSameDay(new Date(s.startsAt), day));
            return (
              <div
                key={di}
                className={
                  "relative flex-1 border-l border-border " + (isToday ? "bg-accent/5" : "")
                }
              >
                {/* Hour lines */}
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-border/50"
                    style={{ top: i * ROW_H }}
                  />
                ))}
                {/* Shift blocks */}
                {dayShifts.map((s) => {
                  const top = (hoursIntoDay(s.startsAt) - bandStart) * ROW_H;
                  const height = (hoursIntoDay(s.endsAt) - hoursIntoDay(s.startsAt)) * ROW_H;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onSelect(s)}
                      className="absolute inset-x-1 overflow-hidden rounded-lg border border-accent bg-accent/15 px-2 py-1 text-left text-xs transition hover:bg-accent/25"
                      style={{ top: top + 1, height: Math.max(height - 2, 22) }}
                    >
                      <div className="font-medium text-accent truncate">{s.title}</div>
                      <div className="text-muted truncate">
                        {timeLabel(s.startsAt)}–{timeLabel(s.endsAt)}
                      </div>
                      <div className="text-muted truncate">{s.location}</div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  const period = h < 12 ? "a" : "p";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${period}`;
}
