import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

// ============================================================================
// Session cookie.
//
// CAS tells us who someone is exactly once, at the end of the login handshake.
// From then on the session cookie carries that answer. It holds only a netID
// and an issue time, signed with an HMAC so the browser cannot edit it — there
// is no server-side session table to grow, expire, or back up.
//
// Signed, not encrypted: the netID is not a secret (it is in every email
// address on campus). The signature is what matters — it stops someone from
// pasting in a cookie that claims to be somebody else.
// ============================================================================

export const SESSION_COOKIE = "th_session";

/** Twelve hours: long enough for a full day of office hours, short enough that
 *  a shared cluster machine doesn't stay signed in overnight. */
const MAX_AGE_SECONDS = 12 * 60 * 60;

/** Where to send the user after login. Set before the CAS round-trip, read once after. */
export const NEXT_COOKIE = "th_next";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;

  // Refuse to run on a guessable key in production — anyone who knows it can
  // forge a session for any netID, including an admin's.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to at least 16 characters in production. Generate one with: openssl rand -base64 32"
    );
  }
  return "tigerhelp-development-only-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Constant-time compare, so a wrong signature leaks nothing through timing. */
function signatureMatches(payload: string, signature: string): boolean {
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Issues a session for a CAS-verified netID. Route handlers only (it sets a cookie). */
export async function createSession(netid: string): Promise<void> {
  const payload = Buffer.from(JSON.stringify({ netid, iat: Date.now() })).toString(
    "base64url"
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, // never readable from JavaScript
    secure: process.env.NODE_ENV === "production", // localhost is plain http
    // "lax" (not "strict") is required: CAS returns the user by navigating the
    // browser to our callback from fed.princeton.edu, and "strict" would
    // withhold the cookie on that cross-site navigation.
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** The netID of the signed-in user, or null if there is no valid session. */
export async function readSessionNetid(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;

  const payload = raw.slice(0, dot);
  if (!signatureMatches(payload, raw.slice(dot + 1))) return null;

  try {
    const { netid, iat } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof netid !== "string" || typeof iat !== "number") return null;
    // Belt and braces: the cookie's own maxAge already expires it client-side,
    // but a copied cookie shouldn't outlive the session it came from.
    if (Date.now() - iat > MAX_AGE_SECONDS * 1000) return null;
    return netid;
  } catch {
    return null;
  }
}

/** Clears the session. Route handlers only. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Remembers where the user was headed before we bounced them to CAS.
 * Only same-site paths are stored, so a crafted link cannot turn our login
 * into a redirect to someone else's website.
 */
export async function setPostLoginPath(path: string | undefined): Promise<void> {
  const store = await cookies();
  if (!isSafeInternalPath(path)) {
    store.delete(NEXT_COOKIE);
    return;
  }
  store.set(NEXT_COOKIE, path, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // the round-trip to CAS and back; not a durable preference
  });
}

/** Reads and clears the post-login destination, defaulting to the queue. */
export async function takePostLoginPath(): Promise<string> {
  const store = await cookies();
  const path = store.get(NEXT_COOKIE)?.value;
  store.delete(NEXT_COOKIE);
  return isSafeInternalPath(path) ? path : "/";
}

/** "/queue" yes; "//evil.com" and "https://evil.com" no. */
function isSafeInternalPath(path: string | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}
