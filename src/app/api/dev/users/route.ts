import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// DEV-ONLY: list the seeded identities the switcher can impersonate. Removed
// together with the rest of the dev-auth shim once CAS is wired in.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { netid: "asc" }],
    select: { netid: true, name: true, role: true },
  });
  return NextResponse.json({ users });
}
