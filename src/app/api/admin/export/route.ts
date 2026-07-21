import { getCurrentUser } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/http";
import {
  buildDataset,
  serialize,
  isExportDataset,
  exportFilename,
  type ExportFormat,
} from "@/lib/admin-export";

// GET /api/admin/export?dataset=ta-metrics&range=28&format=csv
//
// Admin-only. Streams the requested dataset as CSV (a download) or TSV (for
// pasting into a spreadsheet). The dashboard's Export menu links straight here;
// nothing about the analytics is exposed that the dashboard doesn't already
// show the same admin.
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Not signed in.");
    if (user.role !== "ADMIN") throw new ApiError(403, "Admins only.");

    const url = new URL(req.url);
    const dataset = url.searchParams.get("dataset") ?? "";
    if (!isExportDataset(dataset)) throw new ApiError(400, "Unknown dataset.");

    const range = Number(url.searchParams.get("range"));
    const days = [7, 14, 28, 90].includes(range) ? range : 28;

    const format: ExportFormat = url.searchParams.get("format") === "tsv" ? "tsv" : "csv";

    const { header, rows } = await buildDataset(dataset, days);
    const body = serialize(header, rows, format);

    return new Response(body, {
      headers: {
        "Content-Type":
          format === "tsv"
            ? "text/tab-separated-values; charset=utf-8"
            : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename(dataset, days, format)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
