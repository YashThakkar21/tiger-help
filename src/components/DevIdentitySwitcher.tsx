"use client";

import { useEffect, useState } from "react";

type DevUser = { netid: string; name: string; role: string };

// DEV-ONLY control for acting as any seeded user before CAS exists. This is the
// only client-side piece of the auth shim; it disappears when CAS is wired in.
export function DevIdentitySwitcher({ currentNetid }: { currentNetid: string | null }) {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/dev/users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setUsers(d.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  async function switchTo(netid: string) {
    setBusy(true);
    if (netid === "") {
      await fetch("/api/dev/session", { method: "DELETE" });
    } else {
      await fetch("/api/dev/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ netid }),
      });
    }
    window.location.reload();
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span className="hidden sm:inline">Dev identity</span>
      <select
        aria-label="Dev identity"
        disabled={busy}
        value={currentNetid ?? ""}
        onChange={(e) => switchTo(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-foreground"
      >
        <option value="">— signed out —</option>
        {users.map((u) => (
          <option key={u.netid} value={u.netid}>
            {u.name} ({u.role.toLowerCase()})
          </option>
        ))}
      </select>
    </label>
  );
}
