"use client";

import { useEffect } from "react";

// Minimal modal. When `dismissable` is false (e.g. the mandatory feedback prompt)
// there is no close button and clicking the backdrop / pressing Escape does
// nothing — the only way out is to complete it (or close the browser tab).
export function Modal({
  title,
  onClose,
  dismissable = true,
  children,
}: {
  title: string;
  onClose?: () => void;
  dismissable?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!dismissable) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissable, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={dismissable ? onClose : undefined}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          {dismissable && onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-muted hover:text-foreground text-xl leading-none"
            >
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
