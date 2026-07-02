"use client";

import * as React from "react";

import { cn } from "./utils";

export type TooltipSide = "top" | "bottom" | "left" | "right";

const sideClasses: Record<TooltipSide, string> = {
  top: "bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2",
  bottom: "left-1/2 top-[calc(100%+8px)] -translate-x-1/2",
  left: "right-[calc(100%+8px)] top-1/2 -translate-y-1/2",
  right: "left-[calc(100%+8px)] top-1/2 -translate-y-1/2",
};

export function Tooltip({
  label,
  side = "top",
  className,
  children,
}: {
  label: React.ReactNode;
  side?: TooltipSide;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-40 whitespace-nowrap rounded-md border border-[hsl(var(--metal-silver)/0.22)] bg-[hsl(var(--surface-3))] px-2.5 py-1.5 text-[12px] font-medium text-[hsl(var(--foreground))] shadow-[0_10px_24px_hsl(0_0%_0%/0.4)] transition",
          sideClasses[side],
          open ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
      >
        {label}
      </span>
    </span>
  );
}
