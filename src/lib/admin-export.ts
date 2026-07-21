import { prisma } from "@/lib/db";
import { taTable, dailyTraffic, windowStart } from "@/lib/admin-service";

// ============================================================================
// Tabular exports of the admin analytics — CSV to download, TSV to paste
// straight into Google Sheets. Same numbers as the dashboard, in a form an
// admin can pivot, chart, or archive outside the app.
//
// Everything here is admin-only (the route enforces it). Exports include
// student names and feedback-derived per-TA metrics, which never appear on any
// TA-facing surface.
// ============================================================================

export type ExportDataset = "ta-metrics" | "tickets" | "daily-traffic";
export type ExportFormat = "csv" | "tsv";

export function isExportDataset(v: string): v is ExportDataset {
  return v === "ta-metrics" || v === "tickets" || v === "daily-traffic";
}

type Cell = string | number | null;

/**
 * Serializes rows to CSV/TSV, RFC 4180 style: a field is quoted when it
 * contains the delimiter, a quote, or a newline, and embedded quotes are
 * doubled. TSV rarely needs quoting but is handled the same way so a cell with
 * a tab or newline can't shift every column after it.
 */
export function serialize(header: string[], rows: Cell[][], format: ExportFormat): string {
  const delimiter = format === "tsv" ? "\t" : ",";
  const esc = (cell: Cell): string => {
    const s = cell == null ? "" : String(cell);
    if (s.includes(delimiter) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [header, ...rows].map((row) => row.map(esc).join(delimiter));
  // CRLF: the line ending CSV consumers (Excel, Sheets import) expect.
  return lines.join("\r\n");
}

const round = (x: number | null, digits = 2): number | null =>
  x == null ? null : Math.round(x * 10 ** digits) / 10 ** digits;

export const DATASET_LABELS: Record<ExportDataset, string> = {
  "ta-metrics": "TA metrics",
  tickets: "Tickets",
  "daily-traffic": "Daily traffic",
};

/** Builds the header + rows for a dataset, ready to serialize. */
export async function buildDataset(
  dataset: ExportDataset,
  days: number
): Promise<{ header: string[]; rows: Cell[][] }> {
  switch (dataset) {
    case "ta-metrics":
      return taMetricsRows(days);
    case "tickets":
      return ticketRows(days);
    case "daily-traffic":
      return trafficRows(days);
  }
}

async function taMetricsRows(days: number) {
  const rows = await taTable(days);
  return {
    header: [
      "Name", "netID", "Shifts", "Hours on shift", "Students helped",
      "Avg handle (min)", "Avg rating", "Ratings", "No-show rate", "Avg claim position",
    ],
    rows: rows.map((t): Cell[] => [
      t.name,
      t.netid,
      t.shifts,
      t.hoursOnShift,
      t.helped,
      round(t.avgHandleMin, 1),
      round(t.avgRating),
      t.ratingCount,
      round(t.noShowRate, 4),
      round(t.avgClaimPosition, 2),
    ]),
  };
}

async function ticketRows(days: number) {
  const since = windowStart(days);
  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      claimedAt: true,
      resolvedAt: true,
      status: true,
      assignment: true,
      queuePositionAtClaim: true,
      requeuedCount: true,
      course: { select: { code: true } },
      student: { select: { name: true, netid: true } },
      claimedBy: { select: { name: true } },
      feedback: { select: { rating: true } },
    },
  });

  const minsBetween = (a: Date, b: Date | null) =>
    b ? Math.round((b.getTime() - a.getTime()) / 60000) : null;

  return {
    header: [
      "Ticket ID", "Created", "Course", "Assignment", "Student", "netID",
      "Status", "Claimed by", "Wait (min)", "Handle (min)", "Claim position",
      "Requeued", "Rating",
    ],
    rows: tickets.map((t): Cell[] => [
      t.id,
      t.createdAt.toISOString(),
      t.course.code,
      t.assignment,
      t.student.name,
      t.student.netid,
      t.status,
      t.claimedBy?.name ?? null,
      minsBetween(t.createdAt, t.claimedAt),
      t.claimedAt ? minsBetween(t.claimedAt, t.resolvedAt) : null,
      t.queuePositionAtClaim,
      t.requeuedCount,
      t.feedback?.rating ?? null,
    ]),
  };
}

async function trafficRows(days: number) {
  const { days: traffic, courses } = await dailyTraffic(days);
  return {
    header: ["Date", "Total", ...courses],
    rows: traffic.map((d): Cell[] => [d.date, d.total, ...courses.map((c) => d.byCourse[c] ?? 0)]),
  };
}

/** Content-Disposition-safe filename, e.g. ta-metrics-28d-2026-07-20.csv */
export function exportFilename(dataset: ExportDataset, days: number, format: ExportFormat): string {
  const date = new Date().toISOString().slice(0, 10);
  return `tigerhelp-${dataset}-${days}d-${date}.${format}`;
}
