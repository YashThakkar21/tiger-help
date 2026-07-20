import { prisma } from "@/lib/db";
import { estimateWaitMinutes } from "@/lib/queue";
import type { Role } from "@/generated/prisma/enums";

// DB-backed queue reads. There is ONE central queue shared by everyone; course
// is just a tag on each entry, not a filter. Ordering is purely by signup time
// (createdAt), and requeued tickets keep their original createdAt (their place).

/** A student may hold only one open ticket at a time (WAITING or CLAIMED). */
export async function activeTicketFor(studentId: string) {
  return prisma.ticket.findFirst({
    where: { studentId, status: { in: ["WAITING", "CLAIMED"] } },
  });
}

/** Trailing average handle time (minutes) across recent resolved tickets. */
export async function avgHandleMinutes(): Promise<number | null> {
  const recent = await prisma.ticket.findMany({
    where: { status: "RESOLVED", claimedAt: { not: null }, resolvedAt: { not: null } },
    orderBy: { resolvedAt: "desc" },
    take: 20,
    select: { claimedAt: true, resolvedAt: true },
  });
  if (recent.length === 0) return null;
  const mins = recent.map(
    (t) => (t.resolvedAt!.getTime() - t.claimedAt!.getTime()) / 60000
  );
  return mins.reduce((a, b) => a + b, 0) / mins.length;
}

export type Viewer = { id: string; role: Role };

export type QueueEntry = {
  id: string;
  status: string;
  courseCode: string;
  assignment: string;
  summary: string;
  // Full description reveals only to the ticket's owner or a TA once it's claimed.
  description: string | null;
  studentName: string;
  createdAt: string;
  position: number | null; // FIFO position among people still waiting
  estWaitMinutes: number | null; // only meaningful for the viewer's own ticket
  claimedByName: string | null;
  claimedByMe: boolean; // staff-only: did the viewing TA claim this?
  requeued: boolean;
  requeueReason: string | null;
  priorVisits: number;
  isMine: boolean;
};

export type PendingFeedback = {
  ticketId: string;
  summary: string;
  courseCode: string;
  claimedByName: string | null;
};

/**
 * The one queue everyone sees. TAs and students get the same list; the only
 * difference is what they can DO with it (enforced in the action routes) and
 * that TAs can read a claimed ticket's full description.
 */
export async function queueView(viewer: Viewer) {
  const tickets = await prisma.ticket.findMany({
    where: { status: { in: ["WAITING", "CLAIMED"] } },
    orderBy: { createdAt: "asc" },
    include: {
      student: { select: { name: true } },
      claimedBy: { select: { name: true } },
      course: { select: { code: true } },
    },
  });

  const isStaff = viewer.role === "TA" || viewer.role === "ADMIN";
  const avg = await avgHandleMinutes();

  // Repeat-visit indicator (shown to staff): prior finished tickets per student.
  const studentIds = [...new Set(tickets.map((t) => t.studentId))];
  const priorCounts = new Map<string, number>();
  if (isStaff) {
    await Promise.all(
      studentIds.map(async (sid) => {
        const n = await prisma.ticket.count({
          where: { studentId: sid, status: { in: ["RESOLVED", "NO_SHOW", "LEFT"] } },
        });
        priorCounts.set(sid, n);
      })
    );
  }

  let waitingSeen = 0;
  const entries: QueueEntry[] = tickets.map((t) => {
    const isMine = t.studentId === viewer.id;
    let position: number | null = null;
    let estWaitMinutes: number | null = null;
    if (t.status === "WAITING") {
      waitingSeen += 1;
      position = waitingSeen;
      if (isMine) estWaitMinutes = estimateWaitMinutes(avg, waitingSeen - 1);
    }
    const canSeeDescription = isMine || (isStaff && t.status === "CLAIMED");
    return {
      id: t.id,
      status: t.status,
      courseCode: t.course.code,
      assignment: t.assignment,
      summary: t.summary,
      description: canSeeDescription ? t.description : null,
      studentName: t.student.name,
      createdAt: t.createdAt.toISOString(),
      position,
      estWaitMinutes,
      claimedByName: t.claimedBy?.name ?? null,
      claimedByMe: isStaff && t.status === "CLAIMED" && t.claimedById === viewer.id,
      requeued: t.requeuedCount > 0,
      requeueReason: t.requeueReason,
      priorVisits: priorCounts.get(t.studentId) ?? 0,
      isMine,
    };
  });

  return {
    role: viewer.role,
    stats: {
      waiting: entries.filter((e) => e.status === "WAITING").length,
      claimed: entries.filter((e) => e.status === "CLAIMED").length,
      avgHandleMinutes: avg,
    },
    myActiveId: entries.find((e) => e.isMine)?.id ?? null,
    // The ticket this TA currently has in progress (if any). Used to prevent
    // claiming a second student while one is active.
    myClaimedId: entries.find((e) => e.claimedByMe)?.id ?? null,
    pendingFeedback: isStaff ? null : await pendingFeedbackFor(viewer.id),
    tickets: entries,
  };
}

/**
 * A resolved ticket by this student that still needs feedback. Drives the
 * mandatory post-help feedback prompt. Admin-only data lives in Feedback, but
 * this only reveals whether feedback is *missing*, never anyone's ratings.
 */
export async function pendingFeedbackFor(studentId: string): Promise<PendingFeedback | null> {
  const t = await prisma.ticket.findFirst({
    where: { studentId, status: "RESOLVED", feedback: null },
    orderBy: { resolvedAt: "desc" },
    include: {
      claimedBy: { select: { name: true } },
      course: { select: { code: true } },
    },
  });
  if (!t) return null;
  return {
    ticketId: t.id,
    summary: t.summary,
    courseCode: t.course.code,
    claimedByName: t.claimedBy?.name ?? null,
  };
}
