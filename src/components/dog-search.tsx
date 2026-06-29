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
        <div className="relative">
          <Search aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(220_7%_42%)]" />
          <Input
            id="dog-search-input"
            type="text"
            placeholder="Search for a greyhound..."
            aria-label="Search for a greyhound by name"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="pl-11 h-12 text-[15px] bg-white/[0.03] border-white/[0.08] text-[hsl(210_13%_97%)] placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)] rounded-xl tracking-[-0.013em]"
            autoFocus
          />
        </div>

      {loading && (
        <p className="mt-4 text-[14px] text-[hsl(215_14%_65%)] tracking-[-0.013em]">
          Searching...
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {results.map((dog) => (
            <Link
              key={dog.id}
              href={`/dogs/${dog.id}`}
              className="block rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[15px] font-semibold text-[hsl(210_13%_97%)] tracking-[-0.013em]">
                    {dog.name}
                  </span>
                  {dog.sex && (
                    <span className="ml-2 text-[12px] text-[hsl(220_7%_42%)]">
                      {dog.sex === "M" ? "Dog" : "Bitch"}
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-[hsl(220_7%_42%)] tracking-[-0.013em]">
                  {dog._count.formEntries} starts
                </span>
              </div>
              {(dog.sire || dog.dam) && (
                <p className="text-[12px] text-[hsl(220_7%_42%)] mt-1">
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
        <p className="mt-4 text-[14px] text-[hsl(215_14%_65%)] text-center">
          No dogs found matching &quot;{query}&quot;
        </p>
      )}
    </div>
  );
}
