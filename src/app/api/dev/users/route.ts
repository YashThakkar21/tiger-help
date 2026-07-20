import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { devAuthEnabled } from "@/lib/auth";

// DEV-ONLY: list the seeded identities the switcher can impersonate. Removed
// together with the rest of the dev-auth shim once CAS registration is live.
export async function GET() {
  if (!devAuthEnabled()) {
    return NextResponse.json({ error: "Disabled" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { netid: "asc" }],
    select: { netid: true, name: true, role: true },
  });
  return NextResponse.json({ users });
}
