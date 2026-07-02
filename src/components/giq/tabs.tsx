"use client";

import * as React from "react";

import { Button } from "./button";
import { cn } from "./utils";

export type TabItem = string | { label: string; value: string };

export function Tabs({
  items,
  value,
  onChange,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  items: TabItem[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className={cn("giq-segmented", className)} role="tablist" {...props}>
      {items.map((item) => {
        const label = typeof item === "string" ? item : item.label;
        const key = typeof item === "string" ? item : item.value;
        const active = key === value;
        return (
          <Button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            variant={active ? "primary" : "carbon"}
            size="sm"
            onClick={() => onChange?.(key)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
