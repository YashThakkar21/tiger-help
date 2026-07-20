import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/http";
import {
  MIN_DESCRIPTION_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  looksLikeCode,
} from "@/lib/queue";
import { publishQueueChange } from "@/lib/events";

// PATCH /api/tickets/:id — a student edits their description while still waiting.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const description = String(body.description ?? "").trim();

    if (description.length < MIN_DESCRIPTION_LENGTH)
      throw new ApiError(400, `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`);
    if (description.length > MAX_DESCRIPTION_LENGTH)
      throw new ApiError(400, "Description is too long.");
    if (looksLikeCode(description))
      throw new ApiError(400, "Please describe the problem in words, not code.");

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { course: { select: { code: true } } },
    });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    if (ticket.studentId !== user.id)
      throw new ApiError(403, "You can only edit your own ticket.");
    if (ticket.status !== "WAITING")
      throw new ApiError(409, "You can only edit while waiting.");

    await prisma.ticket.update({
      where: { id },
      data: {
        description,
        events: { create: { type: "UPDATED", actorId: user.id } },
      },
    });

    publishQueueChange({ course: ticket.course.code });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
