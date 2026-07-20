import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/http";
import { publishQueueChange } from "@/lib/events";

// POST /api/tickets/:id/resolve — a TA finishes helping and clears the ticket.
// Body: { note?: string }. (Issue tags + student feedback come in later phases.)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const ta = await requireRole("TA", "ADMIN");
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.trim() : null;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { course: { select: { code: true } } },
    });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    if (ticket.status !== "CLAIMED")
      throw new ApiError(409, "Only a claimed ticket can be resolved.");
    // Only the TA who claimed this student may resolve them.
    if (ticket.claimedById !== ta.id)
      throw new ApiError(403, "Only the TA who claimed this student can resolve it.");

    await prisma.ticket.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolutionNote: note,
        events: { create: { type: "RESOLVED", actorId: ta.id } },
      },
    });

    publishQueueChange({ course: ticket.course.code });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
