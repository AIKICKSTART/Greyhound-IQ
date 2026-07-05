"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type RecipientOption = {
  id: string;
  displayName: string;
  role?: string;
  verified?: boolean;
};

export function RecipientPicker() {
  const inputId = useId();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<RecipientOption[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState<RecipientOption | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/profiles/messaging?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Search failed with ${response.status}`);
        }
        const data = (await response.json()) as { items?: RecipientOption[] };
        setOptions(data.items ?? []);
        setActiveIndex(-1);
      } catch {
        if (!controller.signal.aborted) setOptions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  // Block native form submission until a result is actually chosen.
  useEffect(() => {
    inputRef.current?.setCustomValidity(
      selected || query.trim() === ""
        ? ""
        : "Choose a recipient from the search results."
    );
  }, [selected, query]);

  function choose(option: RecipientOption) {
    setSelected(option);
    setQuery(option.displayName);
    setOpen(false);
    setActiveIndex(-1);
    setSearching(false);
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setOptions([]);
    setOpen(false);
    setSearching(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open || options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? options.length - 1 : index - 1
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(options[activeIndex]);
    }
  }

  const status = searching
    ? "Searching profiles"
    : open && query.trim()
      ? `${options.length} profile${options.length === 1 ? "" : "s"} found`
      : "";

  return (
    <div className="block">
      <label
        htmlFor={inputId}
        className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]"
      >
        Recipient
      </label>
      <div className="relative mt-2">
        {selected ? (
          <Check
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--primary-bright))]"
          />
        ) : (
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--subtle-foreground))]"
          />
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          required
          autoComplete="off"
          aria-expanded={open && options.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          placeholder="Search profiles by name"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            const hasValue = value.trim() !== "";
            setQuery(value);
            setSelected(null);
            setOpen(hasValue);
            setActiveIndex(-1);
            if (!hasValue) {
              setOptions([]);
              setSearching(false);
            }
          }}
          onFocus={() => {
            if (query.trim() && !selected) setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
            setSearching(false);
          }}
          onKeyDown={handleKeyDown}
          className="giq-form-control min-h-11 w-full py-2 pl-9 pr-9"
        />
        {selected && (
          <button
            type="button"
            onClick={clearSelection}
            aria-label={`Clear recipient ${selected.displayName}`}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-[hsl(var(--subtle-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <input
        type="hidden"
        name="recipientProfileId"
        value={selected?.id ?? ""}
        readOnly
      />
      <p role="status" className="sr-only">
        {status}
      </p>

      {open && options.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Matching profiles"
          className="mt-2 max-h-56 space-y-1 overflow-y-auto"
        >
          {options.map((option, index) => (
            <li
              key={option.id}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 transition-colors",
                index === activeIndex &&
                  "border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary)/0.12)]"
              )}
            >
              <span className="truncate text-[13px] font-medium text-[hsl(var(--foreground))]">
                {option.displayName}
              </span>
              {option.verified ? (
                <span className="giq-status-pill giq-status-pill-purple shrink-0">
                  Verified
                </span>
              ) : option.role && option.role !== "member" ? (
                <span className="shrink-0 text-[11px] capitalize text-[hsl(var(--subtle-foreground))]">
                  {option.role}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {open && !searching && query.trim() !== "" && options.length === 0 && (
        <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
          No matching profiles.
        </p>
      )}
    </div>
  );
}
