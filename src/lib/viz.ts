// Shared formatting + color helpers for the admin analytics. Client-safe.

/** The CSS variable holding a course's series color (see globals.css). */
export function courseColorVar(code: string): string {
  const key = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `var(--series-${key}, var(--muted))`;
}

/** A sequential shade of the brand accent for a 0..1 intensity, theme-aware. */
export function heatColor(intensity: number): string {
  if (intensity <= 0) return "var(--surface)";
  // Floor at ~12% so the faintest non-zero cell is still visibly warm, not
  // mistaken for empty; mix over the surface so it stays solid in both themes.
  const pct = Math.round((0.12 + intensity * 0.88) * 100);
  return `color-mix(in oklab, var(--accent) ${pct}%, var(--surface))`;
}

/** Cells past the midpoint get dark ink; fainter cells keep theme foreground. */
export function heatTextColor(intensity: number): string {
  return intensity > 0.5 ? "#241a10" : "var(--foreground)";
}

export function formatPercent(x: number | null, digits = 0): string {
  if (x == null) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function formatRating(x: number | null): string {
  return x == null ? "—" : x.toFixed(2);
}

export function formatNumber(x: number | null): string {
  if (x == null) return "—";
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

/** "7 PM", "12 PM", "9 AM" for heatmap hour labels. */
export function formatHour(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour} ${period}`;
}
