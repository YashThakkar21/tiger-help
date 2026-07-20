// ============================================================================
// Princeton CAS (Central Authentication Service) client.
//
// The CAS handshake, end to end:
//   1. We send the browser to  {CAS}/login?service={SERVICE}
//   2. The user types their netID + password on Princeton's page (never ours).
//   3. CAS sends the browser back to SERVICE with ?ticket=ST-xxxx appended.
//   4. We (the server) call {CAS}/validate or /p3/serviceValidate with that
//      ticket. CAS answers with the netID it belongs to.
//   5. We mint our own session cookie (see session.ts) and forget the ticket.
//
// Only step 4 proves anything: the ticket in the URL is worthless until CAS
// confirms it, and it is single-use, so it cannot be replayed.
//
// Everything here is configured by env so a future maintainer can repoint the
// app (staging, a departmental CAS, a mock server) without touching code.
// ============================================================================

/** Princeton's CAS server. Trailing slash is normalized away. */
export function casBaseUrl(): string {
  const raw = process.env.CAS_BASE_URL || "https://fed.princeton.edu/cas";
  return raw.replace(/\/+$/, "");
}

/**
 * The public origin of THIS app.
 *
 * Read from env rather than from the request's Host header on purpose: CAS
 * compares the `service` value at login against the one at validation and
 * rejects a mismatch, and a Host header can be spoofed by the client. One
 * env var means one canonical answer.
 */
export function appBaseUrl(): string {
  const raw = process.env.APP_BASE_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/**
 * The `service` URL we register with CAS. Deliberately constant — no query
 * string. Where to send the user after login travels in a separate cookie
 * instead, because any difference between the login-time and validate-time
 * service string (even URL-encoding) makes CAS reject the ticket.
 */
export function casServiceUrl(): string {
  return `${appBaseUrl()}/api/auth/callback`;
}

/** Where to send the browser to start a login. */
export function casLoginUrl(): string {
  return `${casBaseUrl()}/login?service=${encodeURIComponent(casServiceUrl())}`;
}

/**
 * Ends the Princeton-wide CAS session (every CAS app, not just this one).
 * Signing out of TigerHelp alone does not need this — see the logout route.
 */
export function casLogoutUrl(): string {
  return `${casBaseUrl()}/logout`;
}

export type CasResult =
  | { ok: true; netid: string; name: string | null; email: string | null }
  | { ok: false; code: string; message: string };

/** Pulls the text out of `<cas:tag>text</cas:tag>` (namespace prefix optional). */
function tagText(xml: string, tag: string): string | null {
  const m = xml.match(
    new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:[a-zA-Z0-9]+:)?${tag}>`)
  );
  return m ? m[1].trim() || null : null;
}

/**
 * Validates a service ticket with CAS and returns the netID behind it.
 *
 * Two protocol versions are in play. CAS 3.0 (`/p3/serviceValidate`) answers
 * with XML including attributes — a display name and email, which spare us
 * from provisioning users named after their netID. CAS 1.0 (`/validate`) is
 * the lowest common denominator: two lines of plain text, `yes\n<netid>`, and
 * it is what Princeton's own COS 333 client has always used.
 *
 * We try 3.0 first and fall back to 1.0 ONLY when the 3.0 endpoint isn't there
 * (HTTP 404) or the request never completed. That distinction matters: a
 * ticket is single-use, so once CAS has answered — even to reject — retrying
 * on another endpoint would fail anyway and would only obscure the real error.
 */
export async function validateTicket(ticket: string): Promise<CasResult> {
  const service = casServiceUrl();
  const query = `service=${encodeURIComponent(service)}&ticket=${encodeURIComponent(ticket)}`;

  // --- CAS 3.0 ------------------------------------------------------------
  let res: Response;
  try {
    res = await fetch(`${casBaseUrl()}/p3/serviceValidate?${query}`, {
      cache: "no-store",
    });
  } catch {
    return validateTicketV1(query);
  }

  if (res.status === 404) return validateTicketV1(query);
  if (!res.ok) {
    return {
      ok: false,
      code: "CAS_UNAVAILABLE",
      message: `Princeton CAS returned HTTP ${res.status}.`,
    };
  }

  const xml = await res.text();
  const netid = tagText(xml, "user");
  if (netid) {
    return {
      ok: true,
      netid: netid.toLowerCase(),
      name: tagText(xml, "displayName") ?? tagText(xml, "cn") ?? null,
      email: tagText(xml, "mail") ?? null,
    };
  }

  // CAS reports refusals as <cas:authenticationFailure code="...">.
  const code = xml.match(/authenticationFailure[^>]*code=["']([^"']+)["']/)?.[1];
  return { ok: false, code: code ?? "INVALID_TICKET", message: casFailureMessage(code) };
}

/** CAS 1.0 fallback: responds with `yes\n<netid>` or `no`. */
async function validateTicketV1(query: string): Promise<CasResult> {
  let res: Response;
  try {
    res = await fetch(`${casBaseUrl()}/validate?${query}`, { cache: "no-store" });
  } catch {
    return {
      ok: false,
      code: "CAS_UNREACHABLE",
      message: "Could not reach Princeton CAS. Check your network connection.",
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      code: "CAS_UNAVAILABLE",
      message: `Princeton CAS returned HTTP ${res.status}.`,
    };
  }

  const [verdict, netid] = (await res.text()).split("\n");
  if (verdict?.trim() !== "yes" || !netid?.trim()) {
    return { ok: false, code: "INVALID_TICKET", message: casFailureMessage(undefined) };
  }
  return { ok: true, netid: netid.trim().toLowerCase(), name: null, email: null };
}

/** Turns a CAS error code into something a student can act on. */
function casFailureMessage(code: string | undefined): string {
  switch (code) {
    case "INVALID_SERVICE":
      // The single most likely failure while this app is unregistered: CAS
      // only issues tickets to service URLs it knows about (design doc A1).
      return "Princeton CAS does not recognize this site's address yet. The CAS service registration (see design doc A1) may still be pending, or APP_BASE_URL may not match the URL you're visiting.";
    case "INVALID_TICKET":
      return "That sign-in link has already been used or has expired. Please try again.";
    case "INVALID_REQUEST":
      return "The sign-in request was incomplete. Please try again.";
    default:
      return "Princeton CAS could not verify that sign-in. Please try again.";
  }
}
