import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEV_NETID_COOKIE } from "@/lib/auth";

// DEV-ONLY identity switcher. This route sets/clears the dev netID cookie so we
// can act as any seeded user before CAS exists. It is disabled in production;
// once CAS lands, this whole file is deleted and login goes through CAS instead.

function guard() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  }
  return null;
}

export async function POST(req: Request) {
  const blocked = guard();
  if (blocked) return blocked;

  const { netid } = await req.json().catch(() => ({ netid: null }));
  if (!netid || typeof netid !== "string") {
    return NextResponse.json({ error: "netid required" }, { status: 400 });
  }

  const store = await cookies();
  store.set(DEV_NETID_COOKIE, netid, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const blocked = guard();
  if (blocked) return blocked;

  const store = await cookies();
  store.delete(DEV_NETID_COOKIE);
  return NextResponse.json({ ok: true });
}
