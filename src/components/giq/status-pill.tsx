import * as React from "react";

import { cn } from "./utils";

export type GiqStatusTone = "purple" | "gold" | "live" | "muted";

const toneClasses: Record<GiqStatusTone, string> = {
  purple: "text-[hsl(var(--primary-light))]",
  gold: "text-[hsl(var(--secondary-light))]",
  live: "text-[hsl(142_70%_62%)]",
  muted: "text-[hsl(var(--muted-foreground))]",
};

export function StatusPill({
  tone = "purple",
  dot = true,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: GiqStatusTone;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-[34px] items-center gap-2 rounded-lg border border-[hsl(var(--metal-silver)/0.22)] bg-[linear-gradient(180deg,hsl(0_0%_100%/0.11),hsl(0_0%_100%/0.025)),hsl(var(--surface-2)/0.68)] px-3 text-[11px] font-bold uppercase tracking-[0.12em] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.14),0_10px_22px_hsl(0_0%_0%/0.16)] backdrop-blur",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("pulse-glow h-[7px] w-[7px] rounded-full", toneClasses[tone])}
          style={{ backgroundColor: "currentColor", boxShadow: "0 0 8px currentColor" }}
        />
      ) : null}
      {children}
    </span>
  );
}
