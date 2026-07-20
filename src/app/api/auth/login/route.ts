import { NextResponse } from "next/server";
import { casLoginUrl } from "@/lib/cas";
import { setPostLoginPath } from "@/lib/session";

// GET /api/auth/login — step 1 of the CAS handshake: hand the browser over to
// Princeton. Nothing is trusted here; we are only sending the user away.
//
// ?next=/some/path is remembered in a cookie rather than in the CAS `service`
// URL, because CAS compares that URL byte-for-byte when the ticket comes back.

export const dynamic = "force-dynamic"; // sets a cookie; never prerender

export async function GET(req: Request) {
  const next = new URL(req.url).searchParams.get("next") ?? undefined;
  await setPostLoginPath(next);
  return NextResponse.redirect(casLoginUrl());
}
