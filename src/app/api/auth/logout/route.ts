import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appBaseUrl, casLogoutUrl } from "@/lib/cas";
import { destroySession } from "@/lib/session";
import { DEV_NETID_COOKIE } from "@/lib/auth";

// POST /api/auth/logout — drops the TigerHelp session.
//
// By default this is a LOCAL sign-out. Princeton's own CAS session lives at
// fed.princeton.edu and ending it would sign the user out of every CAS site
// they have open (Canvas, TigerHub, ...) — surprising on a shared machine, and
// not what "sign out of TigerHelp" should mean. `?everywhere=1` opts into the
// full CAS single sign-out; the login page offers it as a separate choice.
//
// POST, not GET, so a link or an <img> on another site can't sign a user out.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await destroySession();
  (await cookies()).delete(DEV_NETID_COOKIE);

  const everywhere = new URL(req.url).searchParams.get("everywhere") === "1";
  const destination = everywhere
    ? casLogoutUrl()
    : new URL("/login?signedout=1", appBaseUrl()).toString();

  // 303 turns the POST into a GET so the browser navigates to the login page
  // instead of re-posting to it.
  return NextResponse.redirect(destination, 303);
}
