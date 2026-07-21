import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { myShiftsInRange, openShifts, myUpcomingShifts } from "@/lib/schedule-service";
import { parseWeekParam, addDays, weekParam } from "@/lib/schedule-week";

// GET /api/schedule?week=YYYY-MM-DD — the signed-in TA's week of shifts, the
// swap board, and their next few upcoming shifts. Staff only.
export async function GET(req: Request) {
  try {
    const user = await requireRole("TA", "ADMIN");
    const weekRaw = new URL(req.url).searchParams.get("week") ?? undefined;
    const monday = parseWeekParam(weekRaw);
    const nextMonday = addDays(monday, 7);

    const [mine, open, upcoming] = await Promise.all([
      myShiftsInRange(user.id, monday, nextMonday),
      openShifts(user.id),
      myUpcomingShifts(user.id),
    ]);

    return NextResponse.json({
      viewerId: user.id,
      weekStart: weekParam(monday),
      myShifts: mine,
      openShifts: open,
      upcoming,
    });
  } catch (e) {
    return apiError(e);
  }
}
