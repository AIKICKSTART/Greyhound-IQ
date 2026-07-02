"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";

type SearchResult = {
  id: string;
  name: string;
  colour: string | null;
  sex: string | null;
  trainer: { name: string } | null;
  sire: { name: string } | null;
  dam: { name: string } | null;
  _count: { formEntries: number };
};

export function DogSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/dogs/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const data = (await res.json()) as SearchResult[];
        setResults(data);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("[dog-search] failed:", err);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  function handleQueryChange(next: string) {
    setQuery(next);
    if (next.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
  }

  return (
      <div className="w-full max-w-2xl mx-auto">
        <label htmlFor="dog-search-input" className="sr-only">
          Search for a greyhound
        </label>
        <div className="giq-input-panel relative">
          <Search aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--subtle-foreground))]" />
          <Input
            id="dog-search-input"
            type="text"
            placeholder="Search for a greyhound..."
            aria-label="Search for a greyhound by name"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="h-12 rounded-xl border-0 bg-transparent pl-11 text-[15px] text-[hsl(var(--foreground))] tracking-[-0.013em] placeholder:text-[hsl(var(--subtle-foreground))] focus-visible:ring-0"
            autoFocus
          />
        </div>

      {loading && (
        <p className="mt-4 text-[14px] text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
          Searching...
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {results.map((dog) => (
            <Link
              key={dog.id}
              href={`/dogs/${dog.id}`}
              className="giq-glass-panel block p-4 transition-[translate,border-color,background-color,box-shadow] motion-safe:hover:-translate-y-0.5"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[15px] font-semibold text-[hsl(var(--foreground))] tracking-[-0.013em]">
                    {dog.name}
                  </span>
                  {dog.sex && (
                    <span className="ml-2 text-[12px] text-[hsl(var(--subtle-foreground))]">
                      {dog.sex === "M" ? "Dog" : "Bitch"}
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-[hsl(var(--subtle-foreground))] tracking-[-0.013em]">
                  {dog._count.formEntries} starts
                </span>
              </div>
              {(dog.sire || dog.dam) && (
                <p className="text-[12px] text-[hsl(var(--subtle-foreground))] mt-1">
                  {dog.sire && `by ${dog.sire.name}`}
                  {dog.sire && dog.dam && " · "}
                  {dog.dam && `from ${dog.dam.name}`}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="mt-4 text-[14px] text-[hsl(var(--muted-foreground))] text-center">
          No dogs found matching &quot;{query}&quot;
        </p>
      )}
    </div>
  );
}
