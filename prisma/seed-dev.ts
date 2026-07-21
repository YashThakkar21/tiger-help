import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import type { QueueBusyness, TicketStatus } from "../src/generated/prisma/enums";

// ============================================================================
// Synthetic development data for the admin dashboard.
//
// Runs alongside the real seed (`npm run db:seed`) and adds a semester's worth
// of history — students, TAs, tickets, shifts, feedback — so the analytics have
// something to show. Everything it creates is tagged with the `dev-` netid
// prefix and the SEED_TAG marker below, so a re-run wipes only its own data and
// never touches real users or the base seed.
//
//   npm run db:seed:dev
//
// NOT for production. The point is a believable shape: evening peaks, a few
// assignments that spike, TAs who differ from each other — enough texture that
// the heatmap, the KPIs, and the per-TA table each say something.
// ============================================================================

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SEED_TAG = "[dev-seed]"; // stamped into resolution notes so it's identifiable
const DAYS_OF_HISTORY = 28;
const NOW = new Date();

// --- deterministic RNG so re-runs produce the same believable dataset --------
let rngState = 1234567;
function rand(): number {
  // Mulberry32 — tiny, seedable, good enough for fixtures.
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;

// --- cast helpers so we can pass enum string literals ------------------------
const STATUS = (s: string) => s as TicketStatus;
const BUSY = (s: string) => s as QueueBusyness;

// --- people ------------------------------------------------------------------
const STUDENT_NAMES = [
  "Ava Chen", "Liam Patel", "Sofia Rodriguez", "Noah Kim", "Maya Johnson",
  "Ethan Nguyen", "Isabella Garcia", "Lucas Martin", "Mia Thompson", "Oliver Davis",
  "Amara Okafor", "Daniel Lee", "Zoe Williams", "Ryan O'Brien", "Priya Sharma",
  "Jackson Brown", "Chloe Martinez", "Aiden Wong", "Layla Hassan", "Mateo Silva",
];
const TA_NAMES = ["Grace Liu", "Marcus Bell", "Nina Kapoor", "Theo Andersson"];

const COURSES = ["COS126", "COS217", "COS226"] as const;

// Per-course assignments, with a rough "demand weight" — some spike the queue.
const ASSIGNMENTS: Record<string, { name: string; weight: number }[]> = {
  COS126: [
    { name: "Hello", weight: 1 },
    { name: "Loops", weight: 2 },
    { name: "NBody", weight: 4 },
    { name: "Sierpinski", weight: 3 },
    { name: "GuitarHero", weight: 5 },
    { name: "TSP", weight: 3 },
  ],
  COS217: [
    { name: "A Buffer Overrun", weight: 3 },
    { name: "String Processing", weight: 2 },
    { name: "Symbol Table", weight: 4 },
    { name: "Assembly", weight: 5 },
    { name: "Heap Manager", weight: 5 },
  ],
  COS226: [
    { name: "Percolation", weight: 3 },
    { name: "Deques", weight: 4 },
    { name: "Autocomplete", weight: 3 },
    { name: "8-Puzzle", weight: 5 },
    { name: "Kd-Trees", weight: 4 },
    { name: "WordNet", weight: 3 },
  ],
};

const SUMMARIES = [
  "Segfault I can't track down", "Off-by-one in my loop", "Timing out on the autograder",
  "Don't understand the assignment spec", "My output is slightly wrong", "Memory leak somewhere",
  "Recursion isn't terminating", "Confused about the API", "Failing one edge case",
  "NullPointerException on submit", "Wrong answer on large inputs", "Stuck on the data structure choice",
];

const SHIFT_NOTES = [
  "Lots of students stuck on the same edge case in the autograder — worth a Piazza post.",
  "Steady flow all evening. Several NBody force-calculation questions early, deque iterators later.",
  "Quiet start, then a rush right before the deadline. Mostly memory-management confusion.",
  "Repeated questions about the assignment spec — the wording on part 2 is tripping people up.",
  "Handful of segfault debugging sessions. Same missing base case in recursion twice.",
  "Busy the whole time. Assembly assignment is generating a lot of load this week.",
  "Calm night. Used the downtime to help a couple students think through their approach.",
  "Symbol-table hashing questions dominated. A short worked example would deflect a lot of these.",
];

const DESCRIPTIONS = [
  "I've been stuck for over an hour. I've tried rewriting the loop and adding print statements but I still can't see why it fails on the last test case.",
  "I read the spec twice and checked the FAQ. My code compiles and runs but the autograder says my output differs on large inputs and I don't know where to look next.",
  "I think the issue is in how I'm handling the base case, but every change I make either breaks a different test or makes it worse. Not sure how to isolate it.",
  "My program works on the examples in the assignment but crashes on the hidden tests. I've tried valgrind but the output is confusing me.",
];

async function main() {
  console.log("Seeding synthetic dev data…");

  const courses = await prisma.course.findMany({ where: { code: { in: [...COURSES] } } });
  if (courses.length < 3) {
    throw new Error("Run `npm run db:seed` first — the base courses are missing.");
  }
  const courseByCode = new Map(courses.map((c) => [c.code, c]));

  // --- wipe previous synthetic data (idempotent re-runs) ---------------------
  const priorUsers = await prisma.user.findMany({
    where: { netid: { startsWith: "dev-" } },
    select: { id: true },
  });
  const priorIds = priorUsers.map((u) => u.id);
  if (priorIds.length) {
    const priorTickets = await prisma.ticket.findMany({
      where: { studentId: { in: priorIds } },
      select: { id: true },
    });
    const tIds = priorTickets.map((t) => t.id);
    await prisma.feedback.deleteMany({ where: { ticketId: { in: tIds } } });
    await prisma.ticketEvent.deleteMany({ where: { ticketId: { in: tIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: tIds } } });
    await prisma.shift.deleteMany({ where: { taId: { in: priorIds } } });
    console.log(`  cleared prior synthetic data (${tIds.length} tickets)`);
  }

  // --- users -----------------------------------------------------------------
  const students = [];
  for (let i = 0; i < STUDENT_NAMES.length; i++) {
    const netid = `dev-stu-${String(i + 1).padStart(2, "0")}`;
    students.push(
      await prisma.user.upsert({
        where: { netid },
        update: { name: STUDENT_NAMES[i], role: "STUDENT" },
        create: { netid, name: STUDENT_NAMES[i], email: `${netid}@princeton.edu`, role: "STUDENT" },
      })
    );
  }
  const tas = [];
  for (let i = 0; i < TA_NAMES.length; i++) {
    const netid = `dev-ta-${String(i + 1).padStart(2, "0")}`;
    tas.push(
      await prisma.user.upsert({
        where: { netid },
        update: { name: TA_NAMES[i], role: "TA" },
        create: { netid, name: TA_NAMES[i], email: `${netid}@princeton.edu`, role: "TA" },
      })
    );
  }
  console.log(`  ${students.length} students, ${tas.length} TAs`);

  // --- a timestamp on a given past day, weighted toward evening office hours --
  function pastMoment(dayOffset: number): Date {
    const d = new Date(NOW);
    d.setDate(d.getDate() - dayOffset);
    // Evening bias: mostly 16:00–22:00, with a light daytime tail.
    const hour = chance(0.78) ? randInt(16, 22) : randInt(10, 15);
    d.setHours(hour, randInt(0, 59), randInt(0, 59), 0);
    return d;
  }

  // --- shifts ----------------------------------------------------------------
  // Each TA works a different amount, so the per-TA table has real spread.
  const shiftLoad = [10, 8, 6, 4]; // shifts per TA over the window
  let shiftCount = 0;
  for (let t = 0; t < tas.length; t++) {
    const ta = tas[t];
    for (let s = 0; s < shiftLoad[t]; s++) {
      const dayOffset = randInt(1, DAYS_OF_HISTORY);
      const startedAt = pastMoment(dayOffset);
      startedAt.setHours(randInt(17, 19), 0, 0, 0); // shifts begin in the evening
      const endedAt = new Date(startedAt.getTime() + randInt(120, 200) * 60000);
      await prisma.shift.create({
        data: {
          taId: ta.id,
          startedAt,
          endedAt,
          notes: pick(SHIFT_NOTES),
          busyness: BUSY(pick(["QUIET", "STEADY", "STEADY", "SLAMMED"])),
          createdAt: startedAt,
        },
      });
      shiftCount++;
    }
  }
  console.log(`  ${shiftCount} shifts`);

  // --- a flat, weighted pool of (course, assignment) so hot assignments spike -
  const demandPool: { course: string; assignment: string }[] = [];
  for (const course of COURSES) {
    for (const a of ASSIGNMENTS[course]) {
      for (let w = 0; w < a.weight; w++) demandPool.push({ course, assignment: a.name });
    }
  }

  // --- historical tickets ----------------------------------------------------
  // Per day, a bell-ish count with midweek heavier than weekend.
  let ticketCount = 0;
  let resolvedCount = 0;
  for (let dayOffset = DAYS_OF_HISTORY; dayOffset >= 1; dayOffset--) {
    const day = new Date(NOW);
    day.setDate(day.getDate() - dayOffset);
    const dow = day.getDay(); // 0 Sun … 6 Sat
    const weekendQuiet = dow === 0 || dow === 6 ? 0.4 : 1;
    const perDay = Math.round(randInt(4, 11) * weekendQuiet);

    for (let n = 0; n < perDay; n++) {
      const createdAt = pastMoment(dayOffset);
      const { course, assignment } = pick(demandPool);
      const student = pick(students);
      const courseId = courseByCode.get(course)!.id;

      // Outcome mix: mostly resolved, a few no-shows and abandons.
      const roll = rand();
      let status = "RESOLVED";
      if (roll > 0.9) status = "NO_SHOW";
      else if (roll > 0.85) status = "LEFT";

      const waitMin = randInt(2, 45);
      const claimedAt = new Date(createdAt.getTime() + waitMin * 60000);
      const ta = pick(tas);
      const events: {
        type: string;
        actorId: string | null;
        createdAt: Date;
        queuePositionAtClaim?: number;
      }[] = [{ type: "CREATED", actorId: student.id, createdAt }];

      const data: {
        studentId: string;
        courseId: string;
        assignment: string;
        summary: string;
        description: string;
        status: TicketStatus;
        createdAt: Date;
        claimedById?: string;
        claimedAt?: Date;
        queuePositionAtClaim?: number;
        resolvedAt?: Date;
        resolutionNote?: string;
        requeuedCount?: number;
      } = {
        studentId: student.id,
        courseId,
        assignment,
        summary: pick(SUMMARIES),
        description: pick(DESCRIPTIONS),
        status: STATUS(status),
        createdAt,
      };

      if (status === "LEFT") {
        // Gave up while waiting — no claim.
        events.push({ type: "LEFT", actorId: student.id, createdAt: claimedAt });
      } else {
        // Claimed by a TA (records FIFO position, as the real claim route does).
        const posAtClaim = randInt(1, 6);
        data.claimedById = ta.id;
        data.claimedAt = claimedAt;
        data.queuePositionAtClaim = posAtClaim;
        events.push({
          type: "CLAIMED",
          actorId: ta.id,
          createdAt: claimedAt,
          queuePositionAtClaim: posAtClaim,
        });

        if (status === "NO_SHOW") {
          events.push({ type: "NO_SHOW", actorId: ta.id, createdAt: new Date(claimedAt.getTime() + 5 * 60000) });
        } else {
          const handleMin = randInt(4, 28);
          const resolvedAt = new Date(claimedAt.getTime() + handleMin * 60000);
          data.resolvedAt = resolvedAt;
          data.resolutionNote = `${SEED_TAG} helped with ${assignment}`;
          events.push({ type: "RESOLVED", actorId: ta.id, createdAt: resolvedAt });
          resolvedCount++;
        }
      }

      const ticket = await prisma.ticket.create({ data });
      for (const e of events) {
        await prisma.ticketEvent.create({ data: { ticketId: ticket.id, ...e, type: e.type as never } });
      }

      // Feedback on ~80% of resolved tickets, skewed positive.
      if (status === "RESOLVED" && chance(0.8)) {
        const rating = pick([5, 5, 5, 4, 4, 4, 3, 3, 2]); // mostly good, occasional low
        await prisma.feedback.create({
          data: {
            ticketId: ticket.id,
            rating,
            comment: chance(0.4)
              ? pick([
                  "Super helpful, explained it clearly.",
                  "Got me unstuck quickly, thanks!",
                  "Patient and walked me through the debugging.",
                  "Helpful but felt a bit rushed.",
                  "Answered my question but I'm still a little confused.",
                ])
              : null,
            createdAt: data.resolvedAt,
          },
        });
      }
      ticketCount++;
    }
  }
  console.log(`  ${ticketCount} tickets (${resolvedCount} resolved)`);

  // --- a few live tickets right now, so the queue + live view aren't empty ----
  for (let i = 0; i < 3; i++) {
    const course = pick(COURSES);
    const student = students[students.length - 1 - i]; // last few students
    const createdAt = new Date(NOW.getTime() - randInt(3, 25) * 60000);
    // Skip if this student already holds an open ticket.
    const existing = await prisma.ticket.findFirst({
      where: { studentId: student.id, status: { in: ["WAITING", "CLAIMED"] } },
    });
    if (existing) continue;
    const ticket = await prisma.ticket.create({
      data: {
        studentId: student.id,
        courseId: courseByCode.get(course)!.id,
        assignment: pick(ASSIGNMENTS[course]).name,
        summary: pick(SUMMARIES),
        description: pick(DESCRIPTIONS),
        status: STATUS("WAITING"),
        createdAt,
      },
    });
    await prisma.ticketEvent.create({
      data: { ticketId: ticket.id, type: "CREATED" as never, actorId: student.id, createdAt },
    });
  }
  console.log("  + a few live waiting tickets");

  console.log("Done.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
