"use client";

import { useState } from "react";
import { Button, Badge } from "@/components/ui";
import { formatMinutes, minutesSince } from "@/lib/time";
import { MIN_DESCRIPTION_LENGTH } from "@/lib/queue";
import type { Entry } from "@/lib/queue-types";

// The queue as a single compact table. Rows stay one line each; clicking a row
// expands an inline panel with the full description (when visible to the viewer)
// and the actions that role is allowed to take. This keeps a 15-person queue
// readable at a glance.
export function QueueTable({
  tickets,
  role,
  myClaimedId,
  onShift,
  onChange,
}: {
  tickets: Entry[];
  role: string;
  myClaimedId: string | null;
  onShift: boolean;
  onChange: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[620px] text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-border">
            <th className="py-2.5 px-3 w-12">#</th>
            <th className="py-2.5 px-3 w-24">Course</th>
            <th className="py-2.5 px-3">Student</th>
            <th className="py-2.5 px-3">Summary</th>
            <th className="py-2.5 px-3 w-24">Waiting</th>
            <th className="py-2.5 px-3 w-40">Status</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-10 text-center text-muted">
                The queue is empty.
              </td>
            </tr>
          ) : (
            tickets.map((t) => (
              <QueueRow
                key={t.id}
                entry={t}
                role={role}
                myClaimedId={myClaimedId}
                onShift={onShift}
                open={openId === t.id}
                onToggle={() => setOpenId(openId === t.id ? null : t.id)}
                onChange={onChange}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function QueueRow({
  entry,
  role,
  myClaimedId,
  onShift,
  open,
  onToggle,
  onChange,
}: {
  entry: Entry;
  role: string;
  myClaimedId: string | null;
  onShift: boolean;
  open: boolean;
  onToggle: () => void;
  onChange: () => void;
}) {
  const claimed = entry.status === "CLAIMED";

  return (
    <>
      <tr
        onClick={onToggle}
        className={
          "border-b border-border cursor-pointer transition hover:bg-background " +
          (entry.isMine ? "bg-accent/5" : "") +
          (open ? " bg-background" : "")
        }
      >
        <td className="py-2.5 px-3 font-medium tabular-nums text-muted">
          {entry.position != null ? entry.position : "—"}
        </td>
        <td className="py-2.5 px-3">
          <Badge>{entry.courseCode}</Badge>
        </td>
        <td className="py-2.5 px-3 font-medium whitespace-nowrap">
          {entry.isMine ? "You" : entry.studentName}
          {entry.requeued && (
            <span className="ml-2 align-middle">
              <Badge
                className="border-amber-500 text-amber-600"
                title={entry.requeueReason ?? "Requeued"}
              >
                requeued
              </Badge>
            </span>
          )}
        </td>
        <td className="py-2.5 px-3 max-w-0">
          <div className="truncate text-muted">{entry.summary}</div>
        </td>
        <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">
          {formatMinutes(minutesSince(entry.createdAt))}
        </td>
        <td className="py-2.5 px-3">
          {claimed ? (
            <span className="text-accent text-xs">
              {entry.isMine
                ? `${entry.claimedByName} helping you`
                : `In progress · ${entry.claimedByName}`}
            </span>
          ) : (
            <span className="text-muted text-xs">Waiting</span>
          )}
        </td>
      </tr>

      {open && (
        <tr className="border-b border-border bg-background">
          <td colSpan={6} className="px-4 pb-4 pt-1">
            <RowDetail
              entry={entry}
              role={role}
              myClaimedId={myClaimedId}
              onShift={onShift}
              onChange={onChange}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function RowDetail({
  entry,
  role,
  myClaimedId,
  onShift,
  onChange,
}: {
  entry: Entry;
  role: string;
  myClaimedId: string | null;
  onShift: boolean;
  onChange: () => void;
}) {
  const isStaff = role === "TA" || role === "ADMIN";
  const claimed = entry.status === "CLAIMED";
  // This TA already has a different student in progress → can't claim another.
  const blockedByOtherClaim = myClaimedId != null && myClaimedId !== entry.id;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "resolve" | "requeue" | "edit">("none");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [descDraft, setDescDraft] = useState(entry.description ?? "");

  async function act(url: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const r = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!r.ok) {
      setError((await r.json()).error ?? "Something went wrong.");
      return;
    }
    setMode("none");
    onChange();
  }

  async function saveEdit() {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/tickets/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: descDraft }),
    });
    setBusy(false);
    if (!r.ok) {
      setError((await r.json()).error ?? "Could not save.");
      return;
    }
    setMode("none");
    onChange();
  }

  return (
    <div className="space-y-3">
      <div className="text-sm">
        <span className="text-muted">Assignment:</span> {entry.assignment}
        {entry.isMine && entry.estWaitMinutes != null && (
          <span className="text-muted"> · ~{formatMinutes(entry.estWaitMinutes)} est. wait</span>
        )}
      </div>

      {/* Description: owner sees their own; staff see it once claimed. */}
      {mode !== "edit" &&
        (entry.description ? (
          <p className="rounded-lg border border-border bg-surface p-3 text-sm whitespace-pre-wrap">
            {entry.description}
          </p>
        ) : (
          <p className="text-xs text-muted italic">
            {isStaff
              ? "Full description appears once you claim this ticket."
              : "Only the TA who claims this can read the full description."}
          </p>
        ))}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* --- Actions --- */}
      {isStaff && !claimed && (
        blockedByOtherClaim ? (
          <p className="text-xs text-muted">
            Finish your current student before claiming another.
          </p>
        ) : (
          // The button stays clickable off shift on purpose: clicking it is how
          // a TA learns they need to clock in first. The server enforces the
          // same rule, so this is guidance, not the gate.
          <Button
            onClick={() =>
              onShift
                ? act(`/api/tickets/${entry.id}/claim`)
                : setError("Start your shift before claiming a student.")
            }
            disabled={busy}
          >
            {busy ? "Claiming…" : "Claim"}
          </Button>
        )
      )}

      {/* A claimed ticket can only be resolved/requeued by the TA who claimed it. */}
      {isStaff && claimed && !entry.claimedByMe && (
        <p className="text-xs text-muted">
          In progress with {entry.claimedByName}.
        </p>
      )}

      {isStaff && claimed && entry.claimedByMe && mode === "none" && (
        <div className="flex gap-2">
          <Button onClick={() => setMode("resolve")}>Resolve</Button>
          <Button variant="ghost" onClick={() => setMode("requeue")}>
            Requeue
          </Button>
        </div>
      )}

      {isStaff && claimed && entry.claimedByMe && mode === "resolve" && (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Short resolution note (optional)"
            className="w-full rounded-lg border border-border bg-surface p-3 text-sm min-h-20"
          />
          <div className="flex gap-2">
            <Button onClick={() => act(`/api/tickets/${entry.id}/resolve`, { note })} disabled={busy}>
              {busy ? "Resolving…" : "Mark resolved"}
            </Button>
            <Button variant="ghost" onClick={() => setMode("none")}>Cancel</Button>
          </div>
        </div>
      )}

      {isStaff && claimed && entry.claimedByMe && mode === "requeue" && (
        <div className="space-y-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional) — keeps their place in line"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={() => act(`/api/tickets/${entry.id}/requeue`, { reason })} disabled={busy}>
              {busy ? "Requeuing…" : "Requeue"}
            </Button>
            <Button variant="ghost" onClick={() => setMode("none")}>Cancel</Button>
          </div>
        </div>
      )}

      {entry.isMine && !claimed && mode === "none" && (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => { setDescDraft(entry.description ?? ""); setMode("edit"); }}>
            Edit
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("Leave the queue? Your spot will be given up.")) {
                act(`/api/tickets/${entry.id}/leave`);
              }
            }}
          >
            Leave
          </Button>
        </div>
      )}

      {entry.isMine && mode === "edit" && (
        <div className="space-y-2">
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface p-3 text-sm min-h-28"
          />
          <p className="text-xs text-muted">
            {Math.max(0, MIN_DESCRIPTION_LENGTH - descDraft.trim().length) > 0
              ? `${MIN_DESCRIPTION_LENGTH - descDraft.trim().length} more characters needed`
              : "Length looks good"}
          </p>
          <div className="flex gap-2">
            <Button onClick={saveEdit} disabled={busy}>Save</Button>
            <Button variant="ghost" onClick={() => setMode("none")}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
