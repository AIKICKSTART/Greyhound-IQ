import {
  BadgeCheck,
  PawPrint,
  Search,
  SearchX,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { discoverSocialActorsAndDogs } from "@/lib/social-discovery";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Discover - GreyhoundIQ",
  description: "Find GreyhoundIQ members, pages, businesses, and greyhounds.",
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q = "" }, user] = await Promise.all([searchParams, getCurrentUser()]);
  const current = user?.dbUserId && user.profileId
    ? {
        ...user,
        dbUserId: user.dbUserId,
        profileId: user.profileId,
        displayName: user.name,
        profileRole: user.role ?? "member",
        verified: false,
      }
    : null;
  const results = await discoverSocialActorsAndDogs(q, current);
  const groups = [
    ["People", results.people],
    ["Trainer pages", results.trainers],
    ["Dog pages", results.dogPages],
    ["Businesses", results.businesses],
    ["Punter pages", results.punters],
  ] as const;
  const actorMatches = groups.reduce((total, [, items]) => total + items.length, 0);
  const shownResults = actorMatches + results.dogs.length;

  return (
    <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <header className="relative mb-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)] p-5 sm:p-6">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="program-label">Community directory</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[hsl(var(--foreground))] sm:text-4xl">
              Discover
            </h1>
            <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
              Find people, managed pages, businesses, and greyhounds across
              GreyhoundIQ.
            </p>
          </div>
          <div className="giq-icon-plate hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl lg:flex">
            <UsersRound
              className="h-5 w-5 text-[hsl(var(--primary-bright))]"
              aria-hidden="true"
            />
          </div>
        </div>
        <form
          className="relative mt-5 flex flex-col gap-2 sm:flex-row"
          action="/discover"
          method="get"
          role="search"
        >
          <label className="sr-only" htmlFor="discover-query">
            Search people, pages, businesses, and dogs
          </label>
          <input
            id="discover-query"
            name="q"
            type="search"
            defaultValue={results.query}
            minLength={2}
            maxLength={80}
            enterKeyHint="search"
            className="giq-form-control min-h-11 min-w-0 flex-1 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
            placeholder="Search people, pages, businesses, or dogs"
          />
          <button
            type="submit"
            className="giq-button giq-button-primary min-h-11 w-full px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] sm:w-auto"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </button>
        </form>
      </header>

      {results.query.length < 2 ? (
        <div className="giq-empty-state px-5 py-12 text-center">
          <Search className="mx-auto h-8 w-8 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
          <h2 className="mt-4 text-[18px] font-semibold text-[hsl(var(--foreground))]">
            Search the community
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-[hsl(var(--muted-foreground))]">
            Enter at least two characters to find people, pages, businesses,
            or greyhounds.
          </p>
        </div>
      ) : shownResults === 0 ? (
        <div className="giq-empty-state px-5 py-12 text-center" role="status">
          <SearchX className="mx-auto h-8 w-8 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
          <h2 className="mt-4 [overflow-wrap:anywhere] text-[18px] font-semibold text-[hsl(var(--foreground))]">
            No matches for &ldquo;{results.query}&rdquo;
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-[hsl(var(--muted-foreground))]">
            Check the spelling or try a broader name, handle, business, or dog
            search.
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3" aria-live="polite">
            <p className="[overflow-wrap:anywhere] text-[14px] text-[hsl(var(--muted-foreground))]">
              Results for <span className="font-semibold text-[hsl(var(--foreground))]">&ldquo;{results.query}&rdquo;</span>
            </p>
            <span className="giq-status-pill giq-status-pill-purple min-h-8 px-3">
              {shownResults} {shownResults === 1 ? "result" : "results"} shown
            </span>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            {groups.map(([label, items]) => (
              <DiscoveryGroup key={label} label={label} items={items} />
            ))}
            <section className="giq-panel h-full overflow-hidden" aria-labelledby="discover-greyhounds">
              <div className="flex min-h-14 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
                <h2 id="discover-greyhounds" className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
                  Greyhounds
                </h2>
                <span className="text-[12px] font-medium text-[hsl(var(--subtle-foreground))]">
                  {results.dogs.length}
                </span>
              </div>
              {results.dogs.length ? (
                <div className="grid gap-2 p-3 sm:p-4">
                  {results.dogs.map((dog) => (
                    <Link
                      key={dog.id}
                      href={`/dogs/${dog.id}`}
                      className="group flex min-h-16 items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 transition-colors hover:border-[hsl(var(--primary-bright)/0.34)] hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
                    >
                      <span className="giq-icon-plate flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                        <PawPrint
                          className="h-4 w-4 text-[hsl(var(--secondary))]"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block break-words text-[14px] font-semibold text-[hsl(var(--foreground))] transition-colors group-hover:text-[hsl(var(--primary-bright))]">
                          {dog.name}
                        </span>
                        <span className="mt-1 block [overflow-wrap:anywhere] text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                          {[dog.earBrand, dog.colour, dog.sex, dog.trainer?.name]
                            .filter(Boolean)
                            .join(" · ") || "Greyhound profile"}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyGroup />
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function DiscoveryGroup({
  label,
  items,
}: {
  label: string;
  items: Array<{
    id: string;
    handle: string;
    displayName: string;
    profile: { verified: boolean; state: string | null } | null;
    page: { tagline: string | null } | null;
  }>;
}) {
  return (
    <section className="giq-panel h-full overflow-hidden" aria-labelledby={`discover-${label.toLowerCase().replaceAll(" ", "-")}`}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <h2
          id={`discover-${label.toLowerCase().replaceAll(" ", "-")}`}
          className="text-[15px] font-semibold text-[hsl(var(--foreground))]"
        >
          {label}
        </h2>
        <span className="text-[12px] font-medium text-[hsl(var(--subtle-foreground))]">
          {items.length}
        </span>
      </div>
      {items.length ? (
        <div className="grid gap-2 p-3 sm:p-4">
          {items.map((actor) => (
            <Link
              key={actor.id}
              href={`/p/${actor.handle}`}
              className="group flex min-h-16 items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 transition-colors hover:border-[hsl(var(--primary-bright)/0.34)] hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--primary-bright)/0.26)] bg-[hsl(var(--primary)/0.14)] text-[14px] font-semibold text-[hsl(var(--primary-light))]">
                {actor.displayName.trim().charAt(0).toUpperCase() || "G"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start gap-1.5 break-words text-[14px] font-semibold text-[hsl(var(--foreground))] transition-colors group-hover:text-[hsl(var(--primary-bright))]">
                  {actor.displayName}
                  {actor.profile?.verified && (
                    <BadgeCheck
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary-bright))]"
                      aria-label="Verified profile"
                    />
                  )}
                </span>
                <span className="mt-0.5 block [overflow-wrap:anywhere] text-[12px] text-[hsl(var(--subtle-foreground))]">
                  @{actor.handle}
                </span>
                {(actor.page?.tagline || actor.profile?.state) && (
                  <span className="mt-1 block [overflow-wrap:anywhere] text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                    {actor.page?.tagline ?? actor.profile?.state}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyGroup />
      )}
    </section>
  );
}

function EmptyGroup() {
  return (
    <p className="px-4 py-5 text-[12px] text-[hsl(var(--subtle-foreground))] sm:px-5">
      No matches in this group.
    </p>
  );
}
