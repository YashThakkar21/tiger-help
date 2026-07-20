"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

// Top-level navigation. Deliberately a flat strip of two — as the dashboard,
// analytics, and scheduling views arrive they slot in here, and the underline
// keeps working without turning into a menu.
const TABS = [
  { href: "/", label: "Queue" },
  { href: "/calendar", label: "Calendar" },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-surface">
      <div className="w-full max-w-4xl mx-auto px-5 flex gap-1">
        {TABS.map((tab) => {
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
