"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "./utils";

export type SelectOption = {
  label: string;
  value: string;
};

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    icon?: React.ReactNode;
    invalid?: boolean;
    wrapClassName?: string;
  }
>(function Input({ icon, invalid = false, className, wrapClassName, ...props }, ref) {
  return (
    <div className={cn("relative flex items-center", wrapClassName)}>
      {icon ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 inline-flex text-[hsl(var(--subtle-foreground))]"
        >
          {icon}
        </span>
      ) : null}
      <input
        ref={ref}
        className={cn("giq-form-control", icon && "pl-9", invalid && "border-[hsl(var(--destructive)/0.6)]", className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
    </div>
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    invalid?: boolean;
  }
>(function Textarea({ invalid = false, className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn("giq-textarea", invalid && "border-[hsl(var(--destructive)/0.6)]", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select...",
  invalid = false,
  className,
  buttonClassName,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  options: Array<string | SelectOption>;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  buttonClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const normalized = options.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option
  );
  const selected = normalized.find((option) => option.value === value);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(nextValue: string) {
    onChange?.(nextValue);
    setOpen(false);
  }

  function onButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open && ["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      setHover(Math.max(0, normalized.findIndex((option) => option.value === value)));
      return;
    }
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHover((current) => Math.min(normalized.length - 1, current < 0 ? 0 : current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHover((current) => Math.max(0, current < 0 ? 0 : current - 1));
    } else if (event.key === "Enter" && hover >= 0) {
      event.preventDefault();
      pick(normalized[hover].value);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative inline-flex w-full", className)} {...props}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onButtonKeyDown}
        className={cn(
          "giq-form-control flex items-center justify-between gap-2 text-left",
          !selected && "text-[hsl(var(--subtle-foreground))]",
          invalid && "border-[hsl(var(--destructive)/0.6)]",
          buttonClassName
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5 text-[hsl(var(--metal-silver))] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-[60] m-0 max-h-64 list-none overflow-y-auto rounded-xl border border-[hsl(var(--primary-light)/0.32)] bg-[hsl(270_24%_9%)] p-1.5 shadow-[0_0_0_1px_hsl(var(--primary)/0.14),0_22px_48px_hsl(0_0%_0%/0.5)]"
        >
          {normalized.map((option, index) => {
            const isSelected = option.value === value;
            const active = hover === index || (hover === -1 && isSelected);
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(-1)}
                onClick={() => pick(option.value)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-transparent px-3 py-2 text-[14px] font-medium tracking-[-0.013em] text-[hsl(var(--foreground))] transition-colors",
                  active &&
                    "border-[hsl(var(--primary-light)/0.5)] bg-[radial-gradient(ellipse_90%_130%_at_50%_-12%,hsl(var(--primary-bright)/0.55),transparent_60%),linear-gradient(180deg,hsl(var(--primary)/0.92),hsl(281_68%_24%))] font-semibold text-[#f5cf6b] shadow-[inset_0_1px_0_hsl(var(--metal-silver-bright)/0.28),0_4px_12px_hsl(var(--primary)/0.35)]"
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
