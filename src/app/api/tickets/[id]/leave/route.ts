import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/http";
import { publishQueueChange } from "@/lib/events";

// POST /api/tickets/:id/leave — a student leaves the queue (their own ticket only).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { course: { select: { code: true } } },
    });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    if (ticket.studentId !== user.id)
      throw new ApiError(403, "You can only leave your own ticket.");
    if (ticket.status !== "WAITING")
      throw new ApiError(409, "You can only leave while waiting.");

    await prisma.ticket.update({
      where: { id },
      data: {
        status: "LEFT",
        events: { create: { type: "LEFT", actorId: user.id } },
      },
    });

    publishQueueChange({ course: ticket.course.code });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
