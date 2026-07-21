"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

// Top-level navigation. Deliberately a flat strip — as the scheduling views
// arrive they slot in here, and the underline keeps working without turning
// into a menu. Admin is appended only for admins (the route enforces it too).
const BASE_TABS = [
  { href: "/", label: "Queue" },
  { href: "/calendar", label: "Calendar" },
];

export function NavTabs({ role }: { role: string }) {
  const pathname = usePathname();
  const tabs =
    role === "ADMIN" ? [...BASE_TABS, { href: "/admin", label: "Admin" }] : BASE_TABS;

  return (
    <nav className="border-b border-border bg-surface">
      <div className="w-full max-w-4xl mx-auto px-5 flex gap-1">
        {tabs.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "-mb-px border-b-2 px-3 py-2.5 text-sm transition",
                active
                  ? "border-accent text-foreground font-medium"
                  : "border-transparent text-muted hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
