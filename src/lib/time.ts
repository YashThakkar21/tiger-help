// Compact "time since" formatting for wait times. Pure and client-safe.
export function minutesSince(iso: string | Date): number {
  const then = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  return Math.max(0, Math.floor((Date.now() - then) / 60000));
}

export function formatMinutes(mins: number | null): string {
  if (mins == null) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
