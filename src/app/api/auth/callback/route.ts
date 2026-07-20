import { NextResponse } from "next/server";
import { appBaseUrl, validateTicket } from "@/lib/cas";
import { createSession, takePostLoginPath } from "@/lib/session";
import { provisionCasUser } from "@/lib/auth";

// GET /api/auth/callback — step 2 of the CAS handshake: Princeton has sent the
// browser back with ?ticket=ST-xxxx. That ticket is just a claim until CAS
// itself vouches for it, which is what validateTicket() does server-to-server.
//
// Only after that do we create the user (first login provisions them) and mint
// our own session cookie. The ticket is then spent and never stored.

export const dynamic = "force-dynamic";

/** Back to the login page with a message the user can actually act on. */
function failed(message: string) {
  const url = new URL("/login", appBaseUrl());
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const ticket = new URL(req.url).searchParams.get("ticket");
  if (!ticket) {
    // Someone reached the callback without coming from CAS — start over.
    return NextResponse.redirect(new URL("/login", appBaseUrl()));
  }

  const result = await validateTicket(ticket);
  if (!result.ok) {
    console.error(`CAS validation failed [${result.code}]: ${result.message}`);
    return failed(result.message);
  }

  try {
    await provisionCasUser(result);
    await createSession(result.netid);
  } catch (e) {
    console.error("Could not establish a session after CAS login:", e);
    return failed(
      "Signed in with CAS, but TigerHelp could not open your account. Is the database running?"
    );
  }

  return NextResponse.redirect(new URL(await takePostLoginPath(), appBaseUrl()));
}
