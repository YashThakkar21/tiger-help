"use client";

import { useEffect, useState } from "react";

type DevUser = { netid: string; name: string; role: string };

// DEV-ONLY sign-in shortcut shown beneath the CAS button.
//
// It exists for two reasons: CAS service registration is still pending (design
// doc A1), and exercising the student / TA / admin paths needs three identities
// that no single person has. Never rendered in production — the login page
// checks devAuthEnabled(), and the routes it calls refuse to run there.
export function DevSignIn() {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/dev/users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setUsers(d.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  async function signInAs(netid: string) {
    setBusy(true);
    await fetch("/api/dev/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ netid }),
    });
    window.location.assign("/");
  }

  if (users.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-dashed border-border px-5 py-4">
      <p className="text-xs font-medium text-muted">
        Development only — sign in as a seeded user
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {users.map((u) => (
          <button
            key={u.netid}
            disabled={busy}
            onClick={() => signInAs(u.netid)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs transition hover:bg-background disabled:opacity-50"
          >
            {u.name}
            <span className="ml-1.5 text-muted">{u.role.toLowerCase()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
