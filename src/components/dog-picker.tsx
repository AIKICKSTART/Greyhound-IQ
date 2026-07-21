"use client";

import { Search, Loader2, X, Dna } from "lucide-react";
import { useEffect, useState } from "react";

interface DogHit {
  id: string;
  name: string;
  colour: string | null;
  sex: string | null;
}

export interface PickedDog {
  id: string;
  name: string;
}

interface DogPickerProps {
  label: string;
  placeholder: string;
  selected: PickedDog | null;
  onSelect: (dog: PickedDog) => void;
  onClear: () => void;
}

const MIN_QUERY = 1;

/**
 * Single-dog search field. Debounced lookup against the shared dog directory
 * endpoint; emits the chosen dog to the parent. Reused by the cross-analysis
 * tool for both the sire and the dam slot.
 */
export function DogPicker({
  label,
  placeholder,
  selected,
  onSelect,
  onClear,
}: DogPickerProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<DogHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(async () => {
      if (trimmed.length < MIN_QUERY) {
        setHits([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(
          `/api/dogs/search?q=${encodeURIComponent(trimmed)}&limit=8&breeding=1`,
        );
        if (!res.ok) throw new Error("search failed");
        const data: DogHit[] = await res.json();
        setHits(Array.isArray(data) ? data : []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(dog: DogHit) {
    onSelect({ id: dog.id, name: dog.name });
    setQuery("");
    setHits([]);
  }

  return (
    <div>
      <p className="giq-eyebrow mb-2 text-[hsl(var(--subtle-foreground))]">{label}</p>
      {selected ? (
        <div className="giq-subpanel flex items-center justify-between gap-3 px-4 py-3">
          <span className="flex min-w-0 items-center gap-3">
            <span className="giq-icon-plate flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
              <Dna className="h-3.5 w-3.5 text-[hsl(var(--primary-bright))]" />
            </span>
            <span className="truncate text-[14px] font-medium text-[hsl(var(--foreground))]">
              {selected.name}
            </span>
          </span>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
            aria-label={`Clear ${label}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="giq-subpanel flex items-center gap-3 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-[14px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--subtle-foreground))] focus:outline-none"
              aria-label={label}
            />
            {searching && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[hsl(var(--muted-foreground))]" />
            )}
          </div>

          {hits.length > 0 && (
            <ul className="giq-panel absolute z-20 mt-2 max-h-72 w-full overflow-y-auto p-1.5">
              {hits.map((dog) => (
                <li key={dog.id}>
                  <button
                    type="button"
                    onClick={() => pick(dog)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--foreground)/0.05)]"
                  >
                    <span className="giq-icon-plate flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                      <Dna className="h-3.5 w-3.5 text-[hsl(var(--primary-bright))]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[hsl(var(--foreground))]">
                        {dog.name}
                      </span>
                      {(dog.colour || dog.sex) && (
                        <span className="block truncate text-[11px] text-[hsl(var(--subtle-foreground))]">
                          {[dog.sex, dog.colour].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
