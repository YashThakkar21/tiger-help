import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/http";
import { openShiftFor } from "@/lib/shift-service";
import { publishQueueChange } from "@/lib/events";

// POST /api/shifts/start — a TA clocks on.
//
// The start time is the server's, not the client's: it is the raw material for
// the staffing analytics in §4.3, and a browser clock is not evidence.
export async function POST() {
  try {
    const ta = await requireRole("TA", "ADMIN");

    const existing = await openShiftFor(ta.id);
    if (existing) {
      throw new ApiError(409, "You're already on shift.");
    }

    const shift = await prisma.shift.create({
      data: { taId: ta.id },
      select: { id: true, startedAt: true },
    });

    // Everyone's "TAs on shift" count just changed.
    publishQueueChange();
    return NextResponse.json({ ok: true, shift }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
