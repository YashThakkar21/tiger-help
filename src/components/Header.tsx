import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { DevIdentitySwitcher } from "./DevIdentitySwitcher";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ user }: { user: CurrentUser | null }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="w-full max-w-4xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-accent">Tiger</span>Help
        </Link>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-muted hidden sm:inline">
              {user.name} · {user.role.toLowerCase()}
            </span>
          )}
          {/* Dev-only until CAS lands. */}
          <DevIdentitySwitcher currentNetid={user?.netid ?? null} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
