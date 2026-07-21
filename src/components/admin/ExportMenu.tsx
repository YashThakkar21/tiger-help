"use client";

import { useEffect, useRef, useState } from "react";

// Export the dashboard's data. CSV downloads open directly in Excel or import
// into Google Sheets; "Copy for Sheets" puts a tab-separated copy on the
// clipboard so it pastes straight into a sheet, no import step. Both hit the
// same admin-only endpoint and respect the current date range.
const DATASETS: { id: string; label: string; hint: string }[] = [
  { id: "ta-metrics", label: "TA metrics", hint: "per-TA rollups" },
  { id: "tickets", label: "All tickets", hint: "one row per ticket" },
  { id: "daily-traffic", label: "Daily traffic", hint: "tickets per day by course" },
];

export function ExportMenu({ range }: { range: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape — standard menu behavior.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function download(dataset: string) {
    // A plain navigation to the endpoint; Content-Disposition makes it a file.
    window.location.assign(`/api/admin/export?dataset=${dataset}&range=${range}&format=csv`);
    setOpen(false);
  }

  async function copyForSheets(dataset: string, label: string) {
    try {
      const res = await fetch(
        `/api/admin/export?dataset=${dataset}&range=${range}&format=tsv`,
        { cache: "no-store" }
      );
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied("Copy failed");
      setTimeout(() => setCopied(null), 2000);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm transition hover:bg-background"
      >
        {copied ? (
          <span className="text-ok">{copied === "Copy failed" ? copied : `Copied ${copied}`}</span>
        ) : (
          <>
            Export
            <span className="text-xs text-muted">▾</span>
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-xl"
        >
          <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted">
            Download CSV
          </p>
          {DATASETS.map((d) => (
            <button
              key={d.id}
              role="menuitem"
              onClick={() => download(d.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-background"
            >
              <span>{d.label}</span>
              <span className="text-xs text-muted">{d.hint}</span>
            </button>
          ))}

          <div className="my-1 border-t border-border" />
          <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted">
            Copy for Google Sheets
          </p>
          {DATASETS.map((d) => (
            <button
              key={d.id}
              role="menuitem"
              onClick={() => copyForSheets(d.id, d.label)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-background"
            >
              <span className="text-muted">⧉</span>
              {d.label}
            </button>
          ))}
          <p className="px-2 pt-1.5 pb-1 text-[11px] leading-snug text-muted/70">
            Paste into a sheet — columns split automatically.
          </p>
        </div>
      )}
    </div>
  );
}
