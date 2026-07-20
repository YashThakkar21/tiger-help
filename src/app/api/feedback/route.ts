import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/http";
import { MAX_FEEDBACK_COMMENT } from "@/lib/queue";

// POST /api/feedback — a student rates the help they received (mandatory prompt).
// Body: { ticketId, rating: 1-5, comment?: string }.
//
// Feedback is admin-only by design and is never returned by any TA-facing route.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));

    const ticketId = String(body.ticketId ?? "");
    const rating = Number(body.rating);
    const comment =
      typeof body.comment === "string" ? body.comment.trim() : "";

    if (!ticketId) throw new ApiError(400, "ticketId is required.");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      throw new ApiError(400, "Please give a rating from 1 to 5.");
    if (!comment)
      throw new ApiError(400, "Please add a short comment about the help you got.");
    if (comment.length > MAX_FEEDBACK_COMMENT)
      throw new ApiError(400, `Comment must be under ${MAX_FEEDBACK_COMMENT} characters.`);

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { feedback: true },
    });
    if (!ticket) throw new ApiError(404, "Ticket not found.");
    if (ticket.studentId !== user.id)
      throw new ApiError(403, "You can only rate your own help.");
    if (ticket.status !== "RESOLVED")
      throw new ApiError(409, "Only resolved help can be rated.");
    if (ticket.feedback) throw new ApiError(409, "You already rated this.");

    await prisma.feedback.create({
      data: { ticketId, rating, comment },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
