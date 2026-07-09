"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, UserPlus } from "lucide-react";
import { sendFriendRequestAction } from "@/app/actions";

type MemberOption = {
  id: string;
  displayName: string;
  verified?: boolean;
};

// Member search backed by the existing authed + rate-limited
// /api/profiles/messaging endpoint (returns id/displayName/role/verified only).
export function AddFriendSearch({
  excludeProfileIds,
}: {
  excludeProfileIds: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<MemberOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentIds, setSentIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const excluded = new Set(excludeProfileIds);
  // Derive emptiness from the query instead of clearing state in the effect.
  const visibleOptions = query.trim()
    ? options.filter((option) => !excluded.has(option.id))
    : [];

  useEffect(() => {
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
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = (await response.json()) as { items?: MemberOption[] };
        setOptions(data.items ?? []);
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
  }, [query]);

  function addFriend(profileId: string) {
    setError(null);
    const formData = new FormData();
    formData.set("profileId", profileId);
    startTransition(async () => {
      try {
        await sendFriendRequestAction(formData);
        setSentIds((current) => new Set([...current, profileId]));
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error && err.message.includes("rate_limit")
            ? "Too many requests today. Try again later."
            : "Could not send friend request."
        );
      }
    });
  }

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search members</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--subtle-foreground))]"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search members"
          className="giq-form-control min-h-10 w-full py-2 pl-9 pr-3 text-[13px]"
        />
      </label>
      {searching && (
        <p role="status" className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
          Searching…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[12px] text-red-200">
          {error}
        </p>
      )}
      {visibleOptions.length > 0 && (
        <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
          {visibleOptions.map((option) => {
              const sent = sentIds.has(option.id);
              return (
                <li
                  key={option.id}
                  className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5"
                >
                  <span className="min-w-0 truncate text-[13px] font-medium text-[hsl(var(--foreground))]">
                    {option.displayName}
                  </span>
                  <button
                    type="button"
                    disabled={sent || pending}
                    onClick={() => addFriend(option.id)}
                    className="giq-outline-action min-h-8 shrink-0 px-2.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pending && !sent ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <UserPlus className="h-3 w-3" aria-hidden="true" />
                    )}
                    {sent ? "Requested" : "Add"}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
      {!searching && query.trim() && visibleOptions.length === 0 && (
        <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
          No matching members.
        </p>
      )}
    </div>
  );
}
