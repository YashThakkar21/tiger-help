// Queue rules and validation. Kept in one module so policy (min length, no-code)
// lives in a single place; course-configurable settings can later read overrides
// from the Course.settings JSON without changing callers.

export const MIN_DESCRIPTION_LENGTH = 50;
export const MAX_DESCRIPTION_LENGTH = 4000;
export const MAX_SUMMARY_LENGTH = 120;

// Feedback: 1–5 stars (required) + a short optional note.
export const MAX_FEEDBACK_COMMENT = 30;

// The prompt template shown to students (why / context / what they tried).
export const DESCRIPTION_PROMPT =
  "Explain (1) why you're asking for help, (2) the specific assignment and course context, and (3) what you've already tried. Do NOT paste code — describe the problem in words; you'll show code to the TA in person.";

/**
 * Heuristic no-code check. Ticket descriptions must be prose, not code (code is
 * discussed in person). This is intentionally lightweight: it flags obvious code
 * so students rewrite in words, and the form states the policy inline. It is not
 * a security control, so false negatives are acceptable.
 */
export function looksLikeCode(text: string): boolean {
  const signals: RegExp[] = [
    /#include\b/,
    /\b(public|private|protected)\s+(static\s+)?(void|int|class)\b/,
    /\bSystem\.out\.(println|print)\b/,
    /\bprintf\s*\(/,
    /\bdef\s+\w+\s*\(/, // python def
    /\bfor\s*\(.*;.*;.*\)/, // C-style for loop
    /->\s*\w+/, // pointer deref
    /\w+\s*=\s*malloc\s*\(/,
    /;\s*$/m, // statement-terminating semicolons at line ends
    /\{[^}]*\}/, // brace blocks ([^}] already spans newlines)
  ];
  const hits = signals.filter((re) => re.test(text)).length;
  return hits >= 1;
}

export type TicketInput = {
  courseId: string;
  assignment: string;
  summary: string;
  description: string;
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateTicketInput(input: Partial<TicketInput>): ValidationResult {
  const { courseId, assignment, summary, description } = input;

  if (!courseId) return { ok: false, error: "Please choose a course." };
  if (!assignment?.trim()) return { ok: false, error: "Please enter the assignment." };

  const s = summary?.trim() ?? "";
  if (!s) return { ok: false, error: "Please add a one-line summary." };
  if (s.length > MAX_SUMMARY_LENGTH)
    return { ok: false, error: `Summary must be under ${MAX_SUMMARY_LENGTH} characters.` };

  const d = description?.trim() ?? "";
  if (d.length < MIN_DESCRIPTION_LENGTH)
    return {
      ok: false,
      error: `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`,
    };
  if (d.length > MAX_DESCRIPTION_LENGTH)
    return { ok: false, error: `Description is too long.` };
  if (looksLikeCode(d))
    return {
      ok: false,
      error:
        "It looks like your description contains code. Please describe the problem in words — you'll show code to the TA in person.",
    };

  return { ok: true };
}

/** Rough wait estimate: trailing average handle time × number of people ahead. */
export function estimateWaitMinutes(
  avgHandleMinutes: number | null,
  peopleAhead: number
): number | null {
  if (avgHandleMinutes == null) return null;
  return Math.round(avgHandleMinutes * (peopleAhead + 1));
}
