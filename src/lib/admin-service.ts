import { prisma } from "@/lib/db";

// ============================================================================
// Admin analytics. Everything here is computed from the same rows the queue
// writes as a byproduct of running — tickets, ticket_events, shifts, feedback —
// so no metric asks a TA to enter data they wouldn't enter anyway (design doc
// §6). All of it is admin-only; feedback in particular never leaves this layer
// through a TA-facing route.
//
// Scale note: at a few hundred tickets a semester these read the window into
// memory and reduce in JS. That is deliberate — it keeps the logic legible for
// the next maintainer. If a course ever outgrows it, these are the functions to
// push into SQL, and nothing above them changes.
// ============================================================================

/** The window every rollup is computed over. */
export function windowStart(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60000;

export type LabStats = {
  totalTickets: number;
  resolved: number;
  studentsHelped: number; // distinct students with a resolved ticket
  uniqueVisitors: number; // distinct students who joined at all
  medianWaitMin: number | null;
  avgHandleMin: number | null;
  noShowRate: number | null; // no-shows / claimed
  feedbackCount: number;
  avgRating: number | null;
  liveWaiting: number;
  liveClaimed: number;
  tasOnShiftNow: number;
};

/** Top-line numbers for the KPI row. */
export async function labStats(days: number): Promise<LabStats> {
  const since = windowStart(days);

  const [tickets, feedback, live, onShift] = await Promise.all([
    prisma.ticket.findMany({
      where: { createdAt: { gte: since } },
      select: {
        studentId: true,
        status: true,
        createdAt: true,
        claimedAt: true,
        resolvedAt: true,
      },
    }),
    prisma.feedback.findMany({
      where: { createdAt: { gte: since } },
      select: { rating: true },
    }),
    prisma.ticket.groupBy({ by: ["status"], where: { status: { in: ["WAITING", "CLAIMED"] } }, _count: true }),
    prisma.shift.count({ where: { endedAt: null } }),
  ]);

  const resolvedTickets = tickets.filter((t) => t.status === "RESOLVED");
  const claimed = tickets.filter((t) => t.claimedAt);
  const noShows = tickets.filter((t) => t.status === "NO_SHOW");

  const waits = claimed
    .filter((t) => t.claimedAt)
    .map((t) => minutesBetween(t.createdAt, t.claimedAt!));
  const handles = resolvedTickets
    .filter((t) => t.claimedAt && t.resolvedAt)
    .map((t) => minutesBetween(t.claimedAt!, t.resolvedAt!));

  const liveWaiting = live.find((g) => g.status === "WAITING")?._count ?? 0;
  const liveClaimed = live.find((g) => g.status === "CLAIMED")?._count ?? 0;

  return {
    totalTickets: tickets.length,
    resolved: resolvedTickets.length,
    studentsHelped: new Set(resolvedTickets.map((t) => t.studentId)).size,
    uniqueVisitors: new Set(tickets.map((t) => t.studentId)).size,
    medianWaitMin: median(waits),
    avgHandleMin: mean(handles),
    noShowRate: claimed.length ? noShows.length / claimed.length : null,
    feedbackCount: feedback.length,
    avgRating: mean(feedback.map((f) => f.rating)),
    liveWaiting,
    liveClaimed,
    tasOnShiftNow: onShift,
  };
}

// --- Demand heatmap (day-of-week × hour) ------------------------------------

export type Heatmap = {
  /** grid[day 0..6 (Mon..Sun)][hourIndex] = ticket count. */
  grid: number[][];
  hours: number[]; // the hour columns actually shown
  max: number;
  total: number;
};

/**
 * When students ask for help, bucketed by weekday and hour — the demand map the
 * design doc leads its analytics section with. Columns are trimmed to the hours
 * that ever see traffic so the grid isn't mostly empty 3am cells.
 */
export async function demandHeatmap(days: number): Promise<Heatmap> {
  const since = windowStart(days);
  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });

  // Mon..Sun rows (JS getDay is Sun..Sat, so remap).
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let minHour = 23;
  let maxHour = 0;
  for (const t of tickets) {
    const jsDay = t.createdAt.getDay();
    const row = (jsDay + 6) % 7; // Mon=0 … Sun=6
    const hour = t.createdAt.getHours();
    grid[row][hour]++;
    minHour = Math.min(minHour, hour);
    maxHour = Math.max(maxHour, hour);
  }

  if (tickets.length === 0) {
    minHour = 9;
    maxHour = 22;
  }
  const hours: number[] = [];
  for (let h = minHour; h <= maxHour; h++) hours.push(h);

  let max = 0;
  for (const row of grid) for (const h of hours) max = Math.max(max, row[h]);

  return { grid, hours, max, total: tickets.length };
}

// --- Traffic: tickets per day, split by course ------------------------------

export type TrafficDay = {
  date: string; // ISO date (yyyy-mm-dd)
  label: string; // "Jul 14"
  total: number;
  byCourse: Record<string, number>;
};

export async function dailyTraffic(days: number): Promise<{ days: TrafficDay[]; courses: string[] }> {
  const since = windowStart(days);
  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, course: { select: { code: true } } },
  });

  const courses = [...new Set(tickets.map((t) => t.course.code))].sort();
  const buckets = new Map<string, TrafficDay>();

  // Pre-fill every day in the window so gaps render as zero, not as missing.
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = isoDate(d);
    buckets.set(key, {
      date: key,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      total: 0,
      byCourse: Object.fromEntries(courses.map((c) => [c, 0])),
    });
  }

  for (const t of tickets) {
    const key = isoDate(t.createdAt);
    const day = buckets.get(key);
    if (!day) continue;
    day.total++;
    day.byCourse[t.course.code] = (day.byCourse[t.course.code] ?? 0) + 1;
  }

  return { days: [...buckets.values()], courses };
}

// --- Per-assignment demand ---------------------------------------------------

export type AssignmentDemand = { course: string; assignment: string; count: number };

/** Which assignments generate the most load — the staffing signal. */
export async function assignmentDemand(days: number, limit = 10): Promise<AssignmentDemand[]> {
  const since = windowStart(days);
  const grouped = await prisma.ticket.groupBy({
    by: ["assignment", "courseId"],
    where: { createdAt: { gte: since } },
    _count: true,
  });
  const courses = await prisma.course.findMany({ select: { id: true, code: true } });
  const codeById = new Map(courses.map((c) => [c.id, c.code]));

  return grouped
    .map((g) => ({
      course: codeById.get(g.courseId) ?? "—",
      assignment: g.assignment,
      count: g._count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// --- Shifts overview ---------------------------------------------------------

export type ShiftsOverview = {
  totalShifts: number;
  totalHours: number;
  busyness: { QUIET: number; STEADY: number; SLAMMED: number };
};

export async function shiftsOverview(days: number): Promise<ShiftsOverview> {
  const since = windowStart(days);
  const shifts = await prisma.shift.findMany({
    where: { startedAt: { gte: since }, endedAt: { not: null } },
    select: { startedAt: true, endedAt: true, busyness: true },
  });

  let hours = 0;
  const busyness = { QUIET: 0, STEADY: 0, SLAMMED: 0 };
  for (const s of shifts) {
    if (s.endedAt) hours += minutesBetween(s.startedAt, s.endedAt) / 60;
    if (s.busyness) busyness[s.busyness] += 1;
  }

  return { totalShifts: shifts.length, totalHours: Math.round(hours), busyness };
}

// --- Per-TA table + detail ---------------------------------------------------

export type TaRow = {
  id: string;
  name: string;
  netid: string;
  shifts: number;
  hoursOnShift: number;
  helped: number;
  avgHandleMin: number | null;
  avgRating: number | null; // admin-only; derived from feedback TAs can't see
  ratingCount: number;
  noShowRate: number | null;
  avgClaimPosition: number | null; // out-of-FIFO context (design doc §4.3)
};

export type TaDetail = TaRow & {
  busyness: { QUIET: number; STEADY: number; SLAMMED: number };
  recentShifts: { startedAt: string; endedAt: string | null; minutes: number; busyness: string | null; notes: string | null }[];
  recentFeedback: { rating: number; comment: string | null; at: string }[];
  perCourseHelped: { course: string; count: number }[];
};

/**
 * Every metric for every TA, computed together. The design doc is firm that
 * these are shown side by side and never collapsed into a single score — handle
 * time especially is ambiguous (fast can mean efficient or dismissive) — so the
 * service returns the whole row and leaves ranking to a human.
 */
export async function taTable(days: number): Promise<TaRow[]> {
  const since = windowStart(days);
  const tas = await prisma.user.findMany({
    where: { role: { in: ["TA", "ADMIN"] } },
    select: { id: true, name: true, netid: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(tas.map((ta) => taRowFor(ta, since)));
  // Only surface staff who actually did something in the window.
  return rows.filter((r) => r.shifts > 0 || r.helped > 0);
}

async function taRowFor(
  ta: { id: string; name: string; netid: string },
  since: Date
): Promise<TaRow> {
  const [shifts, claimedTickets, feedback] = await Promise.all([
    prisma.shift.findMany({
      where: { taId: ta.id, startedAt: { gte: since } },
      select: { startedAt: true, endedAt: true },
    }),
    prisma.ticket.findMany({
      where: { claimedById: ta.id, claimedAt: { gte: since } },
      select: { status: true, claimedAt: true, resolvedAt: true, queuePositionAtClaim: true },
    }),
    prisma.feedback.findMany({
      where: { ticket: { claimedById: ta.id }, createdAt: { gte: since } },
      select: { rating: true },
    }),
  ]);

  const hours = shifts.reduce(
    (h, s) => h + (s.endedAt ? minutesBetween(s.startedAt, s.endedAt) / 60 : 0),
    0
  );
  const resolved = claimedTickets.filter((t) => t.status === "RESOLVED");
  const noShows = claimedTickets.filter((t) => t.status === "NO_SHOW");
  const handles = resolved
    .filter((t) => t.claimedAt && t.resolvedAt)
    .map((t) => minutesBetween(t.claimedAt!, t.resolvedAt!));
  const positions = claimedTickets
    .map((t) => t.queuePositionAtClaim)
    .filter((p): p is number => p != null);

  return {
    id: ta.id,
    name: ta.name,
    netid: ta.netid,
    shifts: shifts.length,
    hoursOnShift: Math.round(hours * 10) / 10,
    helped: resolved.length,
    avgHandleMin: mean(handles),
    avgRating: mean(feedback.map((f) => f.rating)),
    ratingCount: feedback.length,
    noShowRate: claimedTickets.length ? noShows.length / claimedTickets.length : null,
    avgClaimPosition: mean(positions),
  };
}

/** The click-through detail for one TA. Feedback comments included — admin-only. */
export async function taDetail(taId: string, days: number): Promise<TaDetail | null> {
  const since = windowStart(days);
  const ta = await prisma.user.findUnique({
    where: { id: taId },
    select: { id: true, name: true, netid: true, role: true },
  });
  if (!ta || (ta.role !== "TA" && ta.role !== "ADMIN")) return null;

  const base = await taRowFor(ta, since);

  const [shifts, feedback, perCourse] = await Promise.all([
    prisma.shift.findMany({
      where: { taId, startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
      take: 40, // the panel scrolls, so show the window; cap guards a runaway TA
      select: { startedAt: true, endedAt: true, busyness: true, notes: true },
    }),
    prisma.feedback.findMany({
      where: { ticket: { claimedById: taId }, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100, // all realistic feedback for a semester; the list scrolls
      select: { rating: true, comment: true, createdAt: true },
    }),
    prisma.ticket.groupBy({
      by: ["courseId"],
      where: { claimedById: taId, status: "RESOLVED", claimedAt: { gte: since } },
      _count: true,
    }),
  ]);

  const busyness = { QUIET: 0, STEADY: 0, SLAMMED: 0 };
  for (const s of shifts) if (s.busyness) busyness[s.busyness] += 1;

  const courses = await prisma.course.findMany({ select: { id: true, code: true } });
  const codeById = new Map(courses.map((c) => [c.id, c.code]));

  return {
    ...base,
    busyness,
    recentShifts: shifts.map((s) => ({
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
      minutes: s.endedAt ? Math.round(minutesBetween(s.startedAt, s.endedAt)) : 0,
      busyness: s.busyness,
      notes: s.notes,
    })),
    recentFeedback: feedback.map((f) => ({
      rating: f.rating,
      comment: f.comment,
      at: f.createdAt.toISOString(),
    })),
    perCourseHelped: perCourse
      .map((g) => ({ course: codeById.get(g.courseId) ?? "—", count: g._count }))
      .sort((a, b) => b.count - a.count),
  };
}

// --- small helpers -----------------------------------------------------------

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
