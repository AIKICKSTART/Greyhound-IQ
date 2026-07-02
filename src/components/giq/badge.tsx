import * as React from "react";

import { cn } from "./utils";

export type GiqBadgeVariant =
  | "neutral"
  | "free"
  | "pro"
  | "pro-plus"
  | "purple"
  | "gold"
  | "success"
  | "danger";

const badgeClasses: Record<GiqBadgeVariant, string> = {
  neutral:
    "border-white/10 bg-white/[0.06] text-[hsl(var(--muted-foreground))]",
  free: "border-transparent bg-white/[0.06] text-[hsl(var(--muted-foreground))]",
  pro: "border-[hsl(var(--primary-light)/0.30)] bg-[hsl(var(--primary)/0.16)] text-[hsl(var(--primary-bright))]",
  "pro-plus":
    "border-[hsl(var(--secondary-light)/0.34)] bg-[hsl(var(--secondary)/0.16)] text-[hsl(var(--secondary-light))]",
  purple:
    "border-transparent bg-[hsl(var(--primary)/0.14)] text-[hsl(var(--primary-bright))]",
  gold: "border-transparent bg-[hsl(var(--secondary)/0.14)] text-[hsl(var(--secondary))]",
  success: "border-transparent bg-[hsl(var(--success)/0.16)] text-[hsl(142_70%_62%)]",
  danger:
    "border-transparent bg-[hsl(var(--destructive)/0.16)] text-[hsl(0_90%_72%)]",
};

export function Badge({
  variant = "neutral",
  icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: GiqBadgeVariant;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-[linear-gradient(180deg,hsl(0_0%_100%/0.12),hsl(0_0%_100%/0.01)_55%)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.16),0_2px_6px_hsl(0_0%_0%/0.25)]",
        badgeClasses[variant],
        className
      )}
      {...props}
    >
      {icon ? <span aria-hidden="true" className="inline-flex">{icon}</span> : null}
      {children}
    </span>
  );
}
