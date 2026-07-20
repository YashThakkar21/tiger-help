"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui";
import { MAX_FEEDBACK_COMMENT } from "@/lib/queue";

type Pending = {
  ticketId: string;
  summary: string;
  courseCode: string;
  claimedByName: string | null;
};

// Mandatory post-help feedback. Not dismissable: the student rates the help or
// closes the tab. Ratings are admin-only — the TA never sees them.
export function FeedbackModal({ pending, onDone }: { pending: Pending; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (rating < 1) {
      setError("Please pick a star rating.");
      return;
    }
    if (!comment.trim()) {
      setError("Please add a short comment.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const r = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: pending.ticketId, rating, comment }),
    });
    setSubmitting(false);
    if (!r.ok) {
      setError((await r.json()).error ?? "Could not submit.");
      return;
    }
    onDone();
  }

  return (
    <Modal title="How was your help?" dismissable={false}>
      <p className="text-sm text-muted mb-4">
        {pending.claimedByName ? `${pending.claimedByName} helped you with ` : "You were helped with "}
        <span className="text-foreground font-medium">
          {pending.courseCode} · {pending.summary}
        </span>
        . Your rating is only seen by course staff.
      </p>

      <div className="flex gap-1 mb-4" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="text-3xl leading-none transition"
            style={{ color: (hover || rating) >= n ? "var(--accent)" : "var(--border)" }}
          >
            ★
          </button>
        ))}
      </div>

      <input
        value={comment}
        maxLength={MAX_FEEDBACK_COMMENT}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Required — a few words on the help"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <p className="mt-1 text-xs text-muted">
        {MAX_FEEDBACK_COMMENT - comment.length} characters left
      </p>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-4">
        <Button onClick={submit} disabled={submitting || rating < 1 || !comment.trim()}>
          {submitting ? "Submitting…" : "Submit feedback"}
        </Button>
      </div>
    </Modal>
  );
}
