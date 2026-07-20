// ============================================================================
// The office-hours calendar, shown as Google's own embedded widget.
//
// The schedule lives in Google Calendar so head TAs edit it in a tool they
// already use. Embedding Google's iframe (rather than reading the feed and
// re-rendering it) means there is nothing here to maintain: no parser, no
// recurrence rules, no time-zone handling. The trade is that the widget keeps
// Google's look and is always light-themed.
// ============================================================================

/** Times are shown in campus time, whatever the viewer's laptop is set to. */
export const CAMPUS_TZ = "America/New_York";

/** The "Intro COS Lab" calendar — the fall 2026 default. */
const DEFAULT_CALENDAR_ID =
  "c_772442cccb1e3ec2e8e239a652f3ab420f70c03f4c91ba7f8a4706e11f6b62da@group.calendar.google.com";

/**
 * Pulls the calendar id out of whatever address someone pasted.
 *
 * People reach for whichever Google URL is in front of them — the embed link
 * (`?src=`), the share link (`?cid=`, base64), or just the raw id. All three
 * land here, so nobody has to hunt for the "right" one.
 */
export function calendarIdFrom(raw: string): string {
  const value = raw.trim();
  if (!value) return DEFAULT_CALENDAR_ID;

  // A bare calendar id.
  if (!value.includes("://")) return value;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return DEFAULT_CALENDAR_ID;
  }

  const src = parsed.searchParams.get("src");
  if (src) return src;

  const cid = parsed.searchParams.get("cid");
  if (cid) {
    if (cid.includes("@")) return cid;
    try {
      const decoded = Buffer.from(cid, "base64").toString("utf8");
      if (decoded.includes("@")) return decoded;
    } catch {
      // fall through to the default
    }
  }
  return DEFAULT_CALENDAR_ID;
}

/**
 * The iframe URL.
 *
 * `ctz` is always campus time and is deliberately NOT taken from whatever was
 * pasted: an embed URL copied from a browser carries the time zone of the
 * machine that generated it, so a link made on a laptop set to Pacific would
 * quietly show every office hour three hours early.
 *
 * The `show*` flags strip Google's chrome down to the grid itself, so the
 * widget sits in the page as a calendar rather than as a piece of Google.
 */
export function calendarEmbedUrl(): string {
  const id = calendarIdFrom(process.env.OFFICE_HOURS_CALENDAR ?? "");
  const params = new URLSearchParams({
    src: id,
    ctz: CAMPUS_TZ,
    mode: "WEEK",
    showTitle: "0",
    showPrint: "0",
    showCalendars: "0",
    showTz: "0",
    showNav: "1",
    showDate: "1",
    showTabs: "1",
  });
  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}

/** Opens the full calendar in Google, for "add to my own calendar". */
export function calendarPublicUrl(): string {
  const id = calendarIdFrom(process.env.OFFICE_HOURS_CALENDAR ?? "");
  return `https://calendar.google.com/calendar/u/0?cid=${Buffer.from(id).toString("base64url")}`;
}
