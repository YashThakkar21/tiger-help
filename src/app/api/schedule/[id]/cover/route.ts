import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/http";
import { coverShift } from "@/lib/schedule-service";

// POST /api/schedule/:id/cover — take an open shift off the swap board.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("TA", "ADMIN");
    const { id } = await ctx.params;
    const result = await coverShift(id, user.id);
    if (!result.ok) throw new ApiError(result.status, result.error);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
