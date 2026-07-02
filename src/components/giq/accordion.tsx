"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "./utils";

export type AccordionItem = {
  id?: string;
  question: React.ReactNode;
  answer: React.ReactNode;
};

export function Accordion({
  items,
  type = "single",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  items: AccordionItem[];
  type?: "single" | "multi";
}) {
  const [open, setOpen] = React.useState(() => new Set<string>());

  function toggle(id: string) {
    setOpen((current) => {
      const next = type === "multi" ? new Set(current) : new Set<string>();
      if (current.has(id) && type !== "multi") return new Set();
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {items.map((item, index) => {
        const id = item.id ?? String(index);
        const isOpen = open.has(id);
        return (
          <div
            key={id}
            className="overflow-hidden rounded-[10px] border border-white/[0.06] bg-white/[0.02]"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[14px] font-semibold text-[hsl(var(--foreground))]"
            >
              {item.question}
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-[hsl(var(--secondary-light))] transition-transform",
                  isOpen && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>
            <div className={cn("grid transition-[grid-template-rows]", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
              <div className="overflow-hidden">
                <div className="px-4 pb-4 text-[13.5px] leading-6 text-[hsl(var(--muted-foreground))]">
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
