import { prisma } from "@/lib/db";

// ============================================================================
// The TA schedule + swap board. Reads and mutations for ScheduledShift.
//
// Two questions drive everything: "what am I working?" (assignedTo = me) and
// "what needs covering?" (status = OPEN). The swap protocol is two moves — a TA
// drops a shift they can't make, another TA covers it — each guarded so a TA
// can only give up their own shift and can't cover one that's already taken.
// ============================================================================

export type ScheduleShift = {
  id: string;
  startsAt: string;
  endsAt: string;
  title: string;
  location: string;
  status: "SCHEDULED" | "OPEN";
  assignedToId: string | null;
  assignedToName: string | null;
  droppedByName: string | null;
  isMine: boolean;
};

function toDto(
  s: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    title: string;
    location: string;
    status: "SCHEDULED" | "OPEN";
    assignedToId: string | null;
    assignedTo: { name: string } | null;
    droppedBy: { name: string } | null;
  },
  viewerId: string
): ScheduleShift {
  return {
    id: s.id,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    title: s.title,
    location: s.location,
    status: s.status,
    assignedToId: s.assignedToId,
    assignedToName: s.assignedTo?.name ?? null,
    droppedByName: s.droppedBy?.name ?? null,
    isMine: s.assignedToId === viewerId,
  };
}

const INCLUDE = {
  assignedTo: { select: { name: true } },
  droppedBy: { select: { name: true } },
} as const;

/** The viewer's own shifts overlapping a [from, to) window (the calendar week). */
export async function myShiftsInRange(viewerId: string, from: Date, to: Date): Promise<ScheduleShift[]> {
  const shifts = await prisma.scheduledShift.findMany({
    where: { assignedToId: viewerId, startsAt: { gte: from, lt: to } },
    orderBy: { startsAt: "asc" },
    include: INCLUDE,
  });
  return shifts.map((s) => toDto(s, viewerId));
}

/**
 * Everything on the swap board: upcoming shifts that need a TA. Not limited to
 * the calendar week — an open shift three weeks out still needs covering, and
 * burying it until that week arrives is how coverage gaps get missed.
 */
export async function openShifts(viewerId: string): Promise<ScheduleShift[]> {
  const shifts = await prisma.scheduledShift.findMany({
    where: { status: "OPEN", endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: INCLUDE,
  });
  return shifts.map((s) => toDto(s, viewerId));
}

/** The viewer's next few upcoming shifts, for the "coming up" summary. */
export async function myUpcomingShifts(viewerId: string, limit = 5): Promise<ScheduleShift[]> {
  const shifts = await prisma.scheduledShift.findMany({
    where: { assignedToId: viewerId, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    take: limit,
    include: INCLUDE,
  });
  return shifts.map((s) => toDto(s, viewerId));
}

export type MutationResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Put one of my shifts on the swap board. Only the assigned TA can drop it, and
 * only a shift still in the future — you can't hand off one that's already over.
 */
export async function dropShift(shiftId: string, viewerId: string): Promise<MutationResult> {
  const shift = await prisma.scheduledShift.findUnique({ where: { id: shiftId } });
  if (!shift) return { ok: false, status: 404, error: "Shift not found." };
  if (shift.assignedToId !== viewerId)
    return { ok: false, status: 403, error: "You can only give up your own shift." };
  if (shift.endsAt <= new Date())
    return { ok: false, status: 409, error: "That shift has already passed." };

  await prisma.scheduledShift.update({
    where: { id: shiftId },
    data: { status: "OPEN", assignedToId: null, droppedById: viewerId },
  });
  return { ok: true };
}

/**
 * Cover an open shift. Guarded against the race where two TAs claim the same
 * open slot at once: the update only matches while it's still OPEN, so the
 * second one finds no row and is told someone beat them to it.
 */
export async function coverShift(shiftId: string, viewerId: string): Promise<MutationResult> {
  const shift = await prisma.scheduledShift.findUnique({ where: { id: shiftId } });
  if (!shift) return { ok: false, status: 404, error: "Shift not found." };
  if (shift.status !== "OPEN")
    return { ok: false, status: 409, error: "That shift is no longer open." };
  if (shift.endsAt <= new Date())
    return { ok: false, status: 409, error: "That shift has already passed." };

  try {
    await prisma.scheduledShift.update({
      where: { id: shiftId, status: "OPEN" }, // guards the concurrent-cover race
      data: { status: "SCHEDULED", assignedToId: viewerId, droppedById: null },
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025") {
      return { ok: false, status: 409, error: "Someone else just covered that shift." };
    }
    throw e;
  }
  return { ok: true };
}
