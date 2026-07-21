import { prisma } from "@/lib/db";

// DB reads for shifts. A shift is "open" while endedAt is null; that single
// condition is what both "am I on duty?" and "who is on duty?" reduce to.

/** The TA's currently open shift, or null if they're off duty. */
export async function openShiftFor(taId: string) {
  return prisma.shift.findFirst({
    where: { taId, endedAt: null },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  });
}

/**
 * How many TAs are on duty right now.
 *
 * Students are meant to see this next to their queue position (design doc
 * §4.1) — "four TAs on shift" turns a long queue from alarming into merely
 * slow, and it is the honest answer to "is anyone even here?".
 */
export async function tasOnShiftCount(): Promise<number> {
  return prisma.shift.count({ where: { endedAt: null } });
}
