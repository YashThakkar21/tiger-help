import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/http";
import { validateShiftWrapUp } from "@/lib/shifts";
import { openShiftFor } from "@/lib/shift-service";
import { publishQueueChange } from "@/lib/events";
import type { QueueBusyness } from "@/generated/prisma/enums";

// POST /api/shifts/end — a TA clocks off and files a short wrap-up.
// Body: { notes: string, busyness: "QUIET" | "STEADY" | "SLAMMED" }.
export async function POST(req: Request) {
  try {
    const ta = await requireRole("TA", "ADMIN");
    const body = await req.json().catch(() => ({}));

    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const valid = validateShiftWrapUp({ notes, busyness: body.busyness });
    if (!valid.ok) throw new ApiError(400, valid.error);

    const shift = await openShiftFor(ta.id);
    if (!shift) throw new ApiError(409, "You're not currently on shift.");

    // Don't let a TA walk out on a student they've claimed. Resolving or
    // requeueing first is the difference between a finished interaction and a
    // ticket stuck in CLAIMED with nobody coming back to it.
    const inProgress = await prisma.ticket.findFirst({
      where: { claimedById: ta.id, status: "CLAIMED" },
      select: { id: true },
    });
    if (inProgress) {
      throw new ApiError(
        409,
        "You still have a student in progress. Resolve or requeue them before ending your shift."
      );
    }

    await prisma.shift.update({
      where: { id: shift.id },
      data: {
        endedAt: new Date(),
        notes,
        busyness: body.busyness as QueueBusyness,
      },
    });

    publishQueueChange();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
