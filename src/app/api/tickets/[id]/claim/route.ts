import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/http";
import { openShiftFor } from "@/lib/shift-service";
import { publishQueueChange } from "@/lib/events";

// POST /api/tickets/:id/claim — a TA claims a waiting ticket.
// TAs may claim ANY waiting ticket, not just the head of the line (design doc).
// We record the ticket's FIFO position at claim time for later analytics.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const ta = await requireRole("TA", "ADMIN");
    const { id } = await ctx.params;

    // Must be on shift to help. This is the authoritative check — the client
    // hides the claim action off-shift, but a stale tab (or a shift ended in
    // another window) could still fire this, so the server is the backstop.
    // It also means every claim sits inside a real shift, which the staffing
    // analytics rely on.
    const shift = await openShiftFor(ta.id);
    if (!shift) {
      throw new ApiError(409, "Start your shift before claiming a student.");
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { course: { select: { code: true } } },
    });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    if (ticket.status !== "WAITING")
      throw new ApiError(409, "That ticket is no longer waiting.");

    // One student at a time: a TA who already has a claimed ticket must finish
    // (resolve or requeue) before claiming another.
    const activeClaim = await prisma.ticket.findFirst({
      where: { claimedById: ta.id, status: "CLAIMED" },
      select: { id: true },
    });
    if (activeClaim) {
      throw new ApiError(
        409,
        "You already have a student in progress. Resolve or requeue them first."
      );
    }

    // FIFO position among people still waiting in this course (1-indexed).
    const ahead = await prisma.ticket.count({
      where: {
        courseId: ticket.courseId,
        status: "WAITING",
        createdAt: { lte: ticket.createdAt },
      },
    });

    await prisma.ticket.update({
      where: { id, status: "WAITING" }, // guards against a concurrent claim
      data: {
        status: "CLAIMED",
        claimedById: ta.id,
        claimedAt: new Date(),
        queuePositionAtClaim: ahead,
        events: {
          create: { type: "CLAIMED", actorId: ta.id, queuePositionAtClaim: ahead },
        },
      },
    });

    publishQueueChange({ course: ticket.course.code });
    return NextResponse.json({ ok: true });
  } catch (e) {
    // If two TAs claim at once, the guarded update fails to find the row.
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025") {
      return apiError(new ApiError(409, "Someone else just claimed that ticket."));
    }
    return apiError(e);
  }
}
