import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/http";

// The three intro courses (dropdown source). Public — needed to render the form.
export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    });
    return NextResponse.json({ courses });
  } catch (e) {
    return errorResponse(e);
  }
}
