import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/http";
import { publishQueueChange } from "@/lib/events";

// POST /api/tickets/:id/requeue — a TA claimed but couldn't help this student.
// The ticket returns to WAITING, keeps its original createdAt (and thus its FIFO
// place), and is flagged so a "requeued" tag shows next to the student.
// Body: { reason?: string }.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const ta = await requireRole("TA", "ADMIN");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { course: { select: { code: true } } },
    });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    if (ticket.status !== "CLAIMED")
      throw new ApiError(409, "Only a claimed ticket can be requeued.");
    // Only the TA who claimed this student may requeue them.
    if (ticket.claimedById !== ta.id)
      throw new ApiError(403, "Only the TA who claimed this student can requeue it.");

    await prisma.ticket.update({
      where: { id },
      data: {
        status: "WAITING",
        claimedById: null,
        claimedAt: null,
        queuePositionAtClaim: null,
        requeuedCount: { increment: 1 },
        requeueReason: reason,
        // createdAt intentionally unchanged — keeps their place in line.
        events: { create: { type: "REQUEUED", actorId: ta.id } },
      },
    });

    publishQueueChange({ course: ticket.course.code });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
