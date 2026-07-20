import Link from "next/link";
import { devAuthEnabled, type CurrentUser } from "@/lib/auth";
import { DevIdentitySwitcher } from "./DevIdentitySwitcher";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ user }: { user: CurrentUser | null }) {
  // The dev switcher is only for hopping between seeded roles while developing.
  // It is hidden under a real CAS session (where it would be inert — CAS always
  // wins in resolveNetid) and when signed out (the login page offers dev
  // sign-in there, so a second control would just be a second way to do it).
  const showDevSwitcher = devAuthEnabled() && user?.via === "dev";

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
          {showDevSwitcher && <DevIdentitySwitcher currentNetid={user?.netid ?? null} />}
          {user && (
            // A plain form post: sign-out works without JavaScript, and being a
            // POST means another site can't trigger it with a link or an image.
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="text-xs text-muted transition hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
