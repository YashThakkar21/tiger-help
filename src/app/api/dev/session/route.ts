import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEV_NETID_COOKIE, devAuthEnabled } from "@/lib/auth";

// DEV-ONLY identity switcher. This route sets/clears the dev netID cookie so we
// can act as any seeded user without needing three real netIDs. Disabled in
// production and whenever DEV_IDENTITY_SWITCHER=off; a real CAS session always
// takes precedence over it (see resolveNetid in src/lib/auth.ts).

function guard() {
  if (!devAuthEnabled()) {
    return NextResponse.json({ error: "Disabled" }, { status: 403 });
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
