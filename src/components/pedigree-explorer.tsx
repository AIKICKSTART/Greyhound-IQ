"use client";

import { Search, Loader2, X, Dna } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PedigreeChart } from "@/components/pedigree-chart";
import type { PedigreeNode } from "@/lib/pedigree";

interface DogHit {
  id: string;
  name: string;
  colour: string | null;
  sex: string | null;
}

interface SelectedDog {
  id: string;
  name: string;
}

const MIN_QUERY = 1;

export function PedigreeExplorer() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<DogHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedDog | null>(null);
  const [pedigree, setPedigree] = useState<PedigreeNode | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);
  const [treeMessage, setTreeMessage] = useState<string | null>(null);
  const [treeLoadFailed, setTreeLoadFailed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced search against the shared dog directory endpoint. All state
  // mutations happen inside the async timer callback (never synchronously in
  // the effect body) so a fast typist doesn't thrash render.
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
        const res = await fetch(`/api/dogs/search?q=${encodeURIComponent(trimmed)}&limit=8&breeding=1`);
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

  async function loadPedigree(dog: SelectedDog) {
    setPedigree(null);
    setTreeMessage(null);
    setTreeLoadFailed(false);
    setLoadingTree(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`/api/breeding/pedigree?dogId=${encodeURIComponent(dog.id)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("pedigree failed");
      const data: { pedigree: PedigreeNode | null } = await res.json();
      if (data.pedigree) {
        setPedigree(data.pedigree);
      } else {
        setTreeMessage("No recorded pedigree yet for this dog. Ancestry appears as studbook links resolve.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setTreeMessage("Could not load this pedigree. Try again.");
        setTreeLoadFailed(true);
      }
    } finally {
      setLoadingTree(false);
    }
  }

  async function selectDog(dog: DogHit) {
    const selectedDog = { id: dog.id, name: dog.name };
    setSelected(selectedDog);
    setQuery("");
    setHits([]);
    await loadPedigree(selectedDog);
  }

  function reset() {
    setSelected(null);
    setPedigree(null);
    setTreeMessage(null);
    setTreeLoadFailed(false);
    setQuery("");
    setHits([]);
  }

  return (
    <div>
      <div className="relative">
        <div className="giq-subpanel flex items-center gap-3 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any greyhound — race dogs and breeding sires and dams…"
            className="w-full bg-transparent text-[14px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--subtle-foreground))] focus:outline-none"
            aria-label="Search a dog to view its pedigree"
          />
          {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[hsl(var(--muted-foreground))]" />}
          {(query || selected) && !searching && (
            <button
              type="button"
              onClick={reset}
              className="shrink-0 rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {hits.length > 0 && (
          <ul className="giq-panel absolute z-20 mt-2 max-h-72 w-full overflow-y-auto p-1.5">
            {hits.map((dog) => (
              <li key={dog.id}>
                <button
                  type="button"
                  onClick={() => selectDog(dog)}
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

      {selected && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="giq-eyebrow text-[hsl(var(--subtle-foreground))]">Pedigree of</p>
              <Link
                href={`/dogs/${selected.id}`}
                className="truncate text-[18px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-bright))]"
              >
                {selected.name}
              </Link>
            </div>
            <Link
              href={`/dogs/${selected.id}`}
              className="giq-button giq-button-glass shrink-0 px-4 text-[12px] font-medium"
            >
              Full profile
            </Link>
          </div>

          {loadingTree ? (
            <div className="giq-panel flex items-center justify-center gap-3 p-12 text-[13px] text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-4 w-4 animate-spin" /> Building the family tree…
            </div>
          ) : pedigree ? (
            <PedigreeChart root={pedigree} generations={5} />
          ) : (
            <div className="giq-dashed-panel p-8 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
              <p>{treeMessage}</p>
              {treeLoadFailed && (
                <button
                  type="button"
                  onClick={() => void loadPedigree(selected)}
                  className="giq-button giq-button-glass mt-4 px-4 text-[12px] font-medium"
                >
                  Retry pedigree
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
