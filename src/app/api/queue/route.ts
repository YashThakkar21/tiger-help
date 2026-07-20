import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/http";
import { validateTicketInput } from "@/lib/queue";
import { activeTicketFor, queueView } from "@/lib/queue-service";
import { publishQueueChange } from "@/lib/events";

async function resolveCourse(codeOrId: string) {
  const course = await prisma.course.findFirst({
    where: { OR: [{ id: codeOrId }, { code: codeOrId }] },
    select: { id: true, code: true, name: true },
  });
  if (!course) throw new ApiError(404, "Unknown course.");
  return course;
}

// GET /api/queue — the single central queue everyone sees (no course filter).
export async function GET() {
  try {
    const user = await requireUser();
    const view = await queueView({ id: user.id, role: user.role });
    return NextResponse.json(view);
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/queue — a student joins the queue with a new ticket.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const course = await resolveCourse(String(body.course ?? ""));

    const input = {
      courseId: course.id,
      assignment: String(body.assignment ?? ""),
      summary: String(body.summary ?? ""),
      description: String(body.description ?? ""),
    };

    const valid = validateTicketInput(input);
    if (!valid.ok) throw new ApiError(400, valid.error);

    // One open ticket per student, across all courses.
    const existing = await activeTicketFor(user.id);
    if (existing) {
      throw new ApiError(
        409,
        "You already have an open ticket. Resolve or leave it before joining again."
      );
    }

    const ticket = await prisma.ticket.create({
      data: {
        studentId: user.id,
        courseId: course.id,
        assignment: input.assignment.trim(),
        summary: input.summary.trim(),
        description: input.description.trim(),
        status: "WAITING",
        events: { create: { type: "CREATED", actorId: user.id } },
      },
      select: { id: true },
    });

    publishQueueChange({ course: course.code });
    return NextResponse.json({ ok: true, ticketId: ticket.id }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
