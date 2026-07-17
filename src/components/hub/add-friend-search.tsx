"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Loader2,
  Search,
  UserPlus,
  UserRoundCheck,
} from "lucide-react";
import { sendFriendRequestAction } from "@/app/actions";

type MemberOption = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
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
  const [searchedQuery, setSearchedQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<ReadonlySet<string>>(new Set());
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);
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
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = (await response.json()) as { items?: MemberOption[] };
        setOptions(data.items ?? []);
        setSearchedQuery(q);
      } catch {
        if (!controller.signal.aborted) {
          setOptions([]);
          setSearchedQuery(q);
          setSearchError("Member search is unavailable. Please try again.");
        }
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
    setRequestError(null);
    setRequestingId(profileId);
    const formData = new FormData();
    formData.set("profileId", profileId);
    startTransition(async () => {
      try {
        await sendFriendRequestAction(formData);
        setSentIds((current) => new Set([...current, profileId]));
        router.refresh();
      } catch (err) {
        setRequestError(
          err instanceof Error && err.message.includes("rate_limit")
            ? "Too many requests today. Try again later."
            : "Could not send friend request.",
        );
      } finally {
        setRequestingId(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
          Search members
        </span>
        <span className="relative mt-2 block">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--subtle-foreground))]"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              setOptions([]);
              setSearchedQuery("");
              setSearchError(null);
              setSearching(Boolean(nextQuery.trim()));
            }}
            placeholder="Name or kennel"
            aria-controls="member-search-results"
            aria-busy={searching}
            aria-invalid={Boolean(searchError)}
            aria-errormessage={searchError ? "member-search-error" : undefined}
            className="giq-form-control min-h-11 w-full py-2 pl-10 pr-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
          />
        </span>
      </label>
      {searching ? (
        <p
          role="status"
          className="flex min-h-6 items-center gap-2 text-[12px] text-[hsl(var(--muted-foreground))]"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Searching members…
        </p>
      ) : null}
      {searchError ? (
        <p id="member-search-error" role="alert" className="text-[12px] leading-relaxed text-red-200">
          {searchError}
        </p>
      ) : null}
      {requestError ? (
        <p role="alert" className="text-[12px] leading-relaxed text-red-200">
          {requestError}
        </p>
      ) : null}
      {visibleOptions.length > 0 ? (
        <ul
          id="member-search-results"
          className="space-y-1"
        >
          {visibleOptions.map((option) => {
            const sent = sentIds.has(option.id);
            const requesting = requestingId === option.id;
            return (
              <li
                key={option.id}
                className="flex min-h-14 items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 transition hover:border-white/[0.12] hover:bg-white/[0.05]"
              >
                <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-[hsl(var(--foreground))]">
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-[hsl(var(--primary)/0.14)] text-[12px] font-bold text-[hsl(var(--primary-light))]">
                    {option.avatarUrl ? (
                      <Image
                        src={option.avatarUrl}
                        alt=""
                        fill
                        className="rounded-full object-cover"
                        sizes="40px"
                        unoptimized={option.avatarUrl.startsWith("/api/media/")}
                      />
                    ) : (
                      option.displayName.trim().charAt(0).toUpperCase() || "G"
                    )}
                  </span>
                  <span className="truncate">{option.displayName}</span>
                  {option.verified ? (
                    <BadgeCheck
                      className="h-4 w-4 shrink-0 text-[hsl(var(--primary-bright))]"
                      aria-label="Verified member"
                    />
                  ) : null}
                </span>
                <button
                  type="button"
                  disabled={sent || pending}
                  onClick={() => addFriend(option.id)}
                  aria-label={
                    sent
                      ? `Friend request sent to ${option.displayName}`
                      : `Add ${option.displayName} as a friend`
                  }
                  className="giq-outline-action min-h-11 shrink-0 px-3 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {requesting ? (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : sent ? (
                    <UserRoundCheck
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {requesting ? "Sending" : sent ? "Requested" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {!searching &&
      !searchError &&
      query.trim() &&
      searchedQuery === query.trim() &&
      visibleOptions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.1] px-3 py-4 text-center text-[12px] text-[hsl(var(--muted-foreground))]">
          No matching members.
        </p>
      ) : null}
      {!query.trim() ? (
        <p className="text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Search by member name or kennel to send a connection request.
        </p>
      ) : null}
    </div>
  );
}
