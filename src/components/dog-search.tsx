"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { Input } from "@/components/ui/input";
import { MotionIsland } from "@/components/motion/motion-island";
import { cn } from "@/lib/utils";
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

function DogSearchInner() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const router = useRouter();

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
        setActiveIndex(-1);
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
    setActiveIndex(-1);
    if (next.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setResults([]);
      setActiveIndex(-1);
      return;
    }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      router.push(`/dogs/${results[activeIndex].id}`);
    }
  }

  const status = loading
    ? "Searching"
    : query.length >= 2
      ? results.length > 0
        ? `${results.length} result${results.length === 1 ? "" : "s"} for ${query}`
        : `No results for ${query}`
      : "";

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
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          placeholder="Search for a greyhound..."
          aria-label="Search for a greyhound by name"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-12 rounded-xl border-0 bg-transparent pl-11 pr-11 text-[15px] text-[hsl(var(--foreground))] tracking-[-0.013em] placeholder:text-[hsl(var(--subtle-foreground))] focus-visible:ring-0"
          autoFocus
        />
        {loading && (
          <Loader2
            aria-hidden="true"
            className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[hsl(var(--subtle-foreground))]"
          />
        )}
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>

      <AnimatePresence initial={false}>
        {results.length > 0 && (
          <m.div
            key="results"
            id={listboxId}
            role="listbox"
            aria-label="Greyhound search results"
            className="mt-3 space-y-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {results.map((dog, i) => (
              <m.div
                key={dog.id}
                role="none"
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(i, 8) * 0.03 }}
              >
                <Link
                  href={`/dogs/${dog.id}`}
                  role="option"
                  id={`${listboxId}-option-${i}`}
                  aria-selected={i === activeIndex}
                  className={cn(
                    "giq-glass-panel block p-4 transition-[translate,border-color,background-color,box-shadow] motion-safe:hover:-translate-y-0.5",
                    i === activeIndex &&
                      "border-[hsl(var(--secondary-light)/0.62)]!"
                  )}
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
              </m.div>
            ))}
          </m.div>
        )}
      </AnimatePresence>

      {!loading && query.length >= 2 && results.length === 0 && (
        <p className="mt-4 text-[14px] text-[hsl(var(--muted-foreground))] text-center">
          No dogs found matching &quot;{query}&quot;
        </p>
      )}
    </div>
  );
}

export function DogSearch() {
  return (
    <MotionIsland>
      <DogSearchInner />
    </MotionIsland>
  );
}
