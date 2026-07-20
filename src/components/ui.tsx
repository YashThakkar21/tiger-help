import { clsx } from "@/lib/clsx";

// Tiny UI primitives so both views stay consistent and readable. Intentionally
// minimal — a maintainer can grow these into a component library later.

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-border bg-surface p-5 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-accent text-accent-fg hover:opacity-90",
    ghost: "border border-border bg-surface hover:bg-background",
    danger: "text-danger border border-border hover:bg-background",
  }[variant];
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
        styles,
        className
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={clsx("block text-sm font-medium mb-1.5", className)}
      {...props}
    />
  );
}
