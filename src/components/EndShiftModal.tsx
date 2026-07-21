"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Button, Label } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import {
  MIN_SHIFT_NOTES_LENGTH,
  SHIFT_NOTES_PROMPT,
  BUSYNESS_OPTIONS,
  type BusynessValue,
} from "@/lib/shifts";

// Clock-out wrap-up. A TA can't leave without saying how busy it was and
// writing a few sentences about what came up — that's the whole point of
// capturing it here, while the shift is still fresh in their head.
export function EndShiftModal({
  onClose,
  onEnded,
}: {
  onClose: () => void;
  onEnded: () => void;
}) {
  const [busyness, setBusyness] = useState<BusynessValue | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const remaining = Math.max(0, MIN_SHIFT_NOTES_LENGTH - notes.trim().length);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const r = await fetch("/api/shifts/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ busyness, notes }),
    });
    setSubmitting(false);
    if (!r.ok) {
      setError((await r.json()).error ?? "Could not end your shift.");
      return;
    }
    onEnded();
  }

  return (
    <Modal title="End your shift" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <Label>How busy was the queue?</Label>
          <div className="grid grid-cols-3 gap-2">
            {BUSYNESS_OPTIONS.map((o) => {
              const selected = busyness === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setBusyness(o.value)}
                  aria-pressed={selected}
                  className={clsx(
                    "rounded-lg border px-3 py-2.5 text-left transition",
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface hover:bg-background"
                  )}
                >
                  <div className={clsx("text-sm font-medium", selected && "text-accent")}>
                    {o.label}
                  </div>
                  <div className="mt-0.5 text-xs text-muted leading-snug">{o.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>Shift notes</Label>
          <p className="mb-2 text-xs text-muted">{SHIFT_NOTES_PROMPT}</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Lots of COS 226 students stuck on the deque iterator — same off-by-one in the resize. A few CAS login questions early on."
            className="w-full rounded-lg border border-border bg-background p-3 text-sm min-h-32"
          />
          <p className="mt-1 text-xs text-muted">
            {remaining > 0
              ? `${remaining} more character${remaining === 1 ? "" : "s"} needed`
              : "Looks good"}
          </p>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting || !busyness || remaining > 0}>
            {submitting ? "Ending…" : "End shift"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Keep working
          </Button>
        </div>
      </form>
    </Modal>
  );
}
