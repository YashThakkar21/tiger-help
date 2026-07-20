"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button, Label } from "@/components/ui";
import { MIN_DESCRIPTION_LENGTH, DESCRIPTION_PROMPT } from "@/lib/queue";

type Course = { id: string; code: string; name: string };

// The sign-up popup opened by the + button. Fills in the ticket and joins.
export function JoinModal({ onClose, onJoined }: { onClose: () => void; onJoined: () => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [course, setCourse] = useState("");
  const [assignment, setAssignment] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((d) => setCourses(d.courses ?? []));
  }, []);

  const remaining = Math.max(0, MIN_DESCRIPTION_LENGTH - description.trim().length);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const r = await fetch("/api/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course, assignment, summary, description }),
    });
    setSubmitting(false);
    if (!r.ok) {
      setError((await r.json()).error ?? "Could not join.");
      return;
    }
    onJoined();
  }

  return (
    <Modal title="Join the help queue" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Course</Label>
            <select
              required
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Choose…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Assignment</Label>
            <input
              required
              value={assignment}
              onChange={(e) => setAssignment(e.target.value)}
              placeholder="e.g. Assignment 4"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <Label>One-line summary</Label>
          <input
            required
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Segfault when freeing my linked list"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <Label>Description</Label>
          <p className="text-xs text-muted mb-1.5">{DESCRIPTION_PROMPT}</p>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe in words: why you're asking, the context, and what you've tried."
            className="w-full rounded-lg border border-border bg-background p-3 text-sm min-h-32"
          />
          <p className="mt-1 text-xs text-muted">
            {remaining > 0 ? `${remaining} more characters needed` : "Length looks good"} ·{" "}
            <span className="text-foreground">No code, please</span> — show code to the TA in person.
          </p>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Joining…" : "Join queue"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
