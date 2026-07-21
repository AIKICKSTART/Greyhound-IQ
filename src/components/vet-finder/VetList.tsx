"use client";

import { MapPinOff } from "lucide-react";
import type { VetResult } from "./vet-utils";
import { VetCard } from "./VetCard";

interface VetListProps {
  results: VetResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}

/** Scrollable results list with an empty state. */
export function VetList({ results, selectedId, onSelect, onClear }: VetListProps): React.JSX.Element {
  if (results.length === 0) {
    return (
      <div className="giq-empty-state flex flex-col items-center gap-3 p-8 text-center">
        <MapPinOff className="h-8 w-8 text-[hsl(var(--subtle-foreground))]" aria-hidden="true" />
        <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">No clinics match your filters</p>
        <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
          Try widening your search, clearing the state or open-now filter, or increasing the radius.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="giq-button giq-button-glass px-4 text-[12px] font-semibold"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Veterinary clinic results">
      {results.map((location) => (
        <li key={location.id}>
          <VetCard location={location} selected={location.id === selectedId} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}
