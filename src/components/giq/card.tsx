import * as React from "react";

import { cn } from "./utils";

export type GiqCardTone = "default" | "elevated" | "glass" | "carbon";

const toneClasses: Record<GiqCardTone, string> = {
  default: "giq-panel",
  elevated: "giq-panel bg-white/[0.05] border-white/10",
  glass: "giq-panel bg-[hsl(var(--surface-2)/0.55)] border-[hsl(var(--metal-silver)/0.20)] backdrop-blur-xl",
  carbon: "giq-carbon-surface",
};

export function Card({
  tone = "default",
  hover = true,
  strip = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: GiqCardTone;
  hover?: boolean;
  strip?: boolean;
}) {
  return (
    <div
      className={cn(toneClasses[tone], hover && "giq-panel-hover", "relative overflow-hidden", className)}
      {...props}
    >
      {strip ? (
        <div
          aria-hidden="true"
          className="race-box-strip absolute inset-x-0 top-0 h-[3px] rounded-none opacity-90"
        />
      ) : null}
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1.5", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-[16px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-[13px] leading-6 tracking-[-0.013em] text-[hsl(var(--muted-foreground))]", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative z-[1]", className)} {...props} />;
}
