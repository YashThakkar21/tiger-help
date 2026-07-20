import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

// ============================================================================
// AUTH SEAM — the ONE place that knows how a request is authenticated.
//
// Today: a dev cookie names which seeded netID you are acting as (no passwords,
// no CAS). The dev identity switcher in the header sets this cookie.
//
// When Princeton CAS is ready: replace the body of `resolveNetid()` with CAS
// session validation (validate the CAS ticket / read the CAS session cookie,
// establish an httpOnly session). NOTHING ELSE in the app needs to change —
// every route and page reads identity through `getCurrentUser()` below, which
// returns a User row keyed by netID exactly as it will under CAS.
// ============================================================================

export const DEV_NETID_COOKIE = "th_dev_netid";

/**
 * Returns the authenticated netID for the current request, or null.
 *
 * >>> CAS SWAP POINT <<<
 * Replace the dev-cookie logic here with CAS ticket validation. The rest of the
 * app depends only on the return value (a netID string), not on how it was found.
 */
async function resolveNetid(): Promise<string | null> {
  const store = await cookies();
  return store.get(DEV_NETID_COOKIE)?.value ?? null;
}

export type CurrentUser = {
  id: string;
  netid: string;
  name: string;
  email: string | null;
  role: Role;
};

/** The authenticated user (looked up by netID), or null if not signed in. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const netid = await resolveNetid();
  if (!netid) return null;

  const user = await prisma.user.findUnique({ where: { netid } });
  if (!user) return null;

  return {
    id: user.id,
    netid: user.netid,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

/** Like getCurrentUser but throws a 401-shaped error when unauthenticated. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Not signed in");
  return user;
}

/** Requires the user to hold one of the given roles; throws 401/403 otherwise. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AuthError(403, "Insufficient permissions");
  }
  return user;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AuthError";
  }
}
