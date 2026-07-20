import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { readSessionNetid } from "@/lib/session";
import type { Role } from "@/generated/prisma/enums";

// ============================================================================
// AUTH SEAM — the ONE place that knows how a request is authenticated.
//
// Identity comes from Princeton CAS: the login handshake lives in
// src/lib/cas.ts and src/app/api/auth/*, and it ends by minting the signed
// session cookie that `resolveNetid()` reads below. Every page and route asks
// `getCurrentUser()` and never learns how the answer was reached, so swapping
// the identity provider again (Google OAuth, a departmental CAS) means editing
// this file and the /api/auth routes, nothing else.
//
// The dev identity switcher survives alongside it, disabled in production. It
// exists because CAS service registration is still pending (design doc A1) and
// because the seeded students/TAs/admins are the only way to exercise every
// role locally — no one has three netIDs.
// ============================================================================

export const DEV_NETID_COOKIE = "th_dev_netid";

/**
 * Whether the "act as a seeded user" shortcut is available.
 *
 * Off in production, always. Set DEV_IDENTITY_SWITCHER=off to turn it off
 * locally too and test the real CAS path in isolation.
 */
export function devAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_IDENTITY_SWITCHER !== "off"
  );
}

/** How the current request proved who it is. */
export type AuthSource = "cas" | "dev";

/**
 * Returns the authenticated netID for the current request, or null.
 * A real CAS session always wins over the dev shortcut.
 */
async function resolveNetid(): Promise<{ netid: string; via: AuthSource } | null> {
  const netid = await readSessionNetid();
  if (netid) return { netid, via: "cas" };

  if (devAuthEnabled()) {
    const store = await cookies();
    const dev = store.get(DEV_NETID_COOKIE)?.value;
    if (dev) return { netid: dev, via: "dev" };
  }
  return null;
}

export type CurrentUser = {
  id: string;
  netid: string;
  name: string;
  email: string | null;
  role: Role;
  via: AuthSource;
};

/** The authenticated user (looked up by netID), or null if not signed in. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const resolved = await resolveNetid();
  if (!resolved) return null;

  const user = await prisma.user.findUnique({ where: { netid: resolved.netid } });
  if (!user) return null;

  return {
    id: user.id,
    netid: user.netid,
    name: user.name,
    email: user.email,
    role: user.role,
    via: resolved.via,
  };
}

/**
 * Creates or refreshes the User row for a CAS-verified netID.
 *
 * There is no sign-up form: anyone with a Princeton netID who logs in becomes a
 * student, and an admin promotes them later. That matches how the roster
 * actually works — students arrive continuously, staff are appointed.
 *
 * BOOTSTRAP_ADMIN_NETIDS solves the chicken-and-egg problem of the very first
 * admin (there is no UI to appoint one yet). It only ever promotes, never
 * demotes, so removing a netID from it does not silently strip access.
 */
export async function provisionCasUser(cas: {
  netid: string;
  name: string | null;
  email: string | null;
}): Promise<void> {
  const bootstrapAdmins = (process.env.BOOTSTRAP_ADMIN_NETIDS ?? "")
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);

  const existing = await prisma.user.findUnique({ where: { netid: cas.netid } });
  const shouldBeAdmin = bootstrapAdmins.includes(cas.netid);

  if (!existing) {
    await prisma.user.create({
      data: {
        netid: cas.netid,
        // CAS 1.0 doesn't return a display name; the netID is a fair stand-in
        // until an admin edits it or a CAS 3.0 validation fills it in.
        name: cas.name ?? cas.netid,
        email: cas.email ?? `${cas.netid}@princeton.edu`,
        role: shouldBeAdmin ? "ADMIN" : "STUDENT",
      },
    });
    return;
  }

  await prisma.user.update({
    where: { netid: cas.netid },
    data: {
      // Keep CAS as the source of truth for name/email, but never overwrite a
      // real value with a blank one.
      ...(cas.name ? { name: cas.name } : {}),
      ...(cas.email ? { email: cas.email } : {}),
      ...(shouldBeAdmin && existing.role !== "ADMIN" ? { role: "ADMIN" as const } : {}),
    },
  });
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
