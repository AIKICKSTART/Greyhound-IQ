"use client";

import { ChevronRight } from "lucide-react";
import type { VetResult } from "./vet-utils";
import { openingStatus, formatDistance } from "./vet-utils";

interface VetCardProps {
  location: VetResult;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** A single clinic row in the results list. Only renders data present on the record. */
export function VetCard({ location, selected, onSelect }: VetCardProps): React.JSX.Element {
  const status = openingStatus(location);
  const secondary = [location.suburb, location.state, location.postcode].filter(Boolean).join(" ");
  const region = location.area || location.state;

  return (
    <button
      type="button"
      onClick={() => onSelect(location.id)}
      aria-current={selected ? "true" : undefined}
      className={`giq-panel giq-panel-hover flex w-full items-center gap-3 p-4 text-left transition-colors ${
        selected ? "border-[hsl(var(--primary)/0.55)] bg-[hsl(var(--primary)/0.10)]" : ""
      }`}
    >
      <span className="min-w-0 flex-1">
        {region && (
          <span className="block truncate text-[11px] font-bold uppercase tracking-[0.05em] text-[hsl(var(--primary-bright))]">
            {region}
          </span>
        )}
        <span className="mt-0.5 block truncate text-[14px] font-semibold text-[hsl(var(--foreground))] tracking-[-0.01em]">
          {location.name}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-[hsl(var(--muted-foreground))] tabular-nums">
          {secondary}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {status && (
            <span
              className={`giq-pill ${status === "open" ? "giq-pill-green" : "giq-pill-muted"} text-[10px]`}
            >
              {status === "open" ? "Open now" : "Closed"}
            </span>
          )}
          {location.greyhoundInterest && (
            <span className="giq-pill giq-pill-gold text-[10px]">Greyhound-focused</span>
          )}
          {Number.isFinite(location.distanceKm) && (
            <span className="giq-pill giq-pill-gold text-[10px] tabular-nums">
              {formatDistance(location.distanceKm as number)}
            </span>
          )}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--subtle-foreground))]" aria-hidden="true" />
    </button>
  );
}
