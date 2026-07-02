"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "./utils";

export function Modal({
  open,
  onClose,
  title,
  footer,
  className,
  children,
}: {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[hsl(270_30%_2%/0.72)] p-5 backdrop-blur"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "relative w-full max-w-[460px] rounded-2xl border border-white/10 bg-[hsl(var(--surface-2))] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.10),0_32px_80px_hsl(0_0%_0%/0.5)]",
          className
        )}
      >
        <div
          aria-hidden="true"
          className="race-box-strip absolute inset-x-5 top-0 h-[3px] rounded-none opacity-85"
        />
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          {title ? <h3 className="giq-h5 m-0">{title}</h3> : <span />}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1 text-[hsl(var(--subtle-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-5 text-[13.5px] leading-6 text-[hsl(var(--muted-foreground))]">
          {children}
        </div>
        {footer ? (
          <div className="flex justify-end gap-2.5 px-5 pb-5">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
