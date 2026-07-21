"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

// Top-level navigation, a flat underlined strip. Tabs are added by role: staff
// (TA + admin) get their shift Schedule; admins additionally get the analytics
// dashboard. Every gated route also enforces its own access — the tab list is
// convenience, not the security boundary.
const BASE_TABS = [
  { href: "/", label: "Queue" },
  { href: "/calendar", label: "Calendar" },
];

export function NavTabs({ role }: { role: string }) {
  const pathname = usePathname();
  const isStaff = role === "TA" || role === "ADMIN";
  const tabs = [
    ...BASE_TABS,
    ...(isStaff ? [{ href: "/schedule", label: "Schedule" }] : []),
    ...(role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

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
