// Week math + formatting for the shift schedule. Client-safe (no Prisma), so
// the calendar component and the API compute week boundaries the same way.
//
// Everything is in the server/browser's local time. In dev these are the same
// machine, so seeded shifts and the calendar agree. A deployed instance would
// pin this to campus time (see calendar-embed's CAMPUS_TZ) — that's the one
// thing to revisit before production.

/** Monday 00:00 of the week containing `d`. Weeks start Monday, like a schedule. */
export function weekStart(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const back = (out.getDay() + 6) % 7; // days since Monday
  out.setDate(out.getDate() - back);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** "2026-07-20" in local time — stable across the ?week= round-trip. */
export function weekParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Reads ?week=YYYY-MM-DD, falling back to the current week. */
export function parseWeekParam(raw: string | undefined): Date {
  const m = raw?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return weekStart(new Date());
  return weekStart(new Date(+m[1], +m[2] - 1, +m[3]));
}

// --- formatting ------------------------------------------------------------

export function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function shortDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function weekRangeLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const f = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${f(monday)} – ${f(sunday)}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Fractional hours since midnight, e.g. 19.5 for 7:30 PM — for calendar placement. */
export function hoursIntoDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}
