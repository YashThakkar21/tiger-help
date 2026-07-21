// Shift rules and vocabulary. Pure and client-safe (no Prisma import), so the
// form and the API validate against exactly the same constants — the pattern
// queue.ts already follows.

/**
 * How much a TA must write before clocking out.
 *
 * Short enough to be a two-sentence answer at the end of a long evening, long
 * enough to rule out "fine". The point is a specific observation — which
 * question kept coming back — not a report.
 */
export const MIN_SHIFT_NOTES_LENGTH = 30;
export const MAX_SHIFT_NOTES_LENGTH = 4000;

/** The prompt shown above the wrap-up box. */
export const SHIFT_NOTES_PROMPT =
  "What came up? Note the questions you answered more than once, anything students got stuck on, and anything the next TA on duty should know.";

export type BusynessValue = "QUIET" | "STEADY" | "SLAMMED";

/**
 * Three buckets, deliberately. A TA closing out at 10pm will answer three
 * options honestly and a seven-point scale carelessly; the hints keep the
 * middle option from becoming a shrug.
 */
export const BUSYNESS_OPTIONS: { value: BusynessValue; label: string; hint: string }[] = [
  { value: "QUIET", label: "Quiet", hint: "Rarely anyone waiting" },
  { value: "STEADY", label: "Steady", hint: "A manageable queue most of the time" },
  { value: "SLAMMED", label: "Slammed", hint: "Students waiting the whole shift" },
];

export function isBusynessValue(v: unknown): v is BusynessValue {
  return BUSYNESS_OPTIONS.some((o) => o.value === v);
}

export type ShiftWrapUp = { notes: string; busyness: unknown };
export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Validates what a TA must supply to end a shift. */
export function validateShiftWrapUp({ notes, busyness }: ShiftWrapUp): ValidationResult {
  if (!isBusynessValue(busyness)) {
    return { ok: false, error: "Please choose how busy the queue was." };
  }

  const n = notes?.trim() ?? "";
  if (n.length < MIN_SHIFT_NOTES_LENGTH) {
    return {
      ok: false,
      error: `Please write at least ${MIN_SHIFT_NOTES_LENGTH} characters about your shift.`,
    };
  }
  if (n.length > MAX_SHIFT_NOTES_LENGTH) {
    return { ok: false, error: "That's longer than we can store — please trim it." };
  }
  return { ok: true };
}

/** Whole minutes a shift has run, for the on-shift timer. */
export function shiftMinutes(startedAt: string | Date, endedAt?: string | Date | null): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 60000));
}
