"use client";

import * as React from "react";
import { AlertCircle, Check, Info, TriangleAlert, X } from "lucide-react";

import { cn } from "./utils";

export type AlertTone = "info" | "success" | "warning" | "danger";

const toneClasses: Record<AlertTone, string> = {
  info: "border-[hsl(var(--primary-light)/0.35)] bg-[hsl(var(--primary)/0.10)] text-[hsl(var(--primary-bright))]",
  success: "border-[hsl(142_60%_42%/0.4)] bg-[hsl(142_60%_42%/0.10)] text-[hsl(142_70%_62%)]",
  warning: "border-[hsl(var(--secondary-light)/0.4)] bg-[hsl(var(--secondary)/0.10)] text-[hsl(var(--secondary-light))]",
  danger: "border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.10)] text-[hsl(0_90%_72%)]",
};

const toneIcons = {
  info: Info,
  success: Check,
  warning: TriangleAlert,
  danger: AlertCircle,
};

export function Alert({
  tone = "info",
  title,
  onDismiss,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
  title?: React.ReactNode;
  onDismiss?: () => void;
}) {
  const Icon = toneIcons[tone];
  return (
    <div
      role="alert"
      className={cn("flex items-start gap-3 rounded-[10px] border p-4", toneClasses[tone], className)}
      {...props}
    >
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? (
          <div className="mb-1 text-[13.5px] font-bold text-[hsl(var(--foreground))]">
            {title}
          </div>
        ) : null}
        {children ? (
          <div className="text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
            {children}
          </div>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 p-0.5 text-[hsl(var(--subtle-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
