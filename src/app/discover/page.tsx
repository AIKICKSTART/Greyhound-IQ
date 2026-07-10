import { BadgeCheck, Search } from "lucide-react";
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

  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="giq-kicker">Member directory</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
          Discover
        </h1>
        <form className="mt-5 flex gap-2" action="/discover">
          <label className="sr-only" htmlFor="discover-query">
            Search people, pages, businesses, and dogs
          </label>
          <input
            id="discover-query"
            name="q"
            defaultValue={results.query}
            minLength={2}
            maxLength={80}
            className="giq-form-control min-h-11 min-w-0 flex-1 px-4"
            placeholder="Search people, pages, businesses, or dogs"
          />
          <button className="giq-button giq-button-primary min-h-11 px-4">
            <Search className="h-4 w-4" />
            Search
          </button>
        </form>
      </header>

      {results.query.length < 2 ? (
        <div className="giq-empty-state p-10 text-center text-[14px] text-[hsl(var(--muted-foreground))]">
          Enter at least two characters to search the GreyhoundIQ community.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, items]) => (
            <DiscoveryGroup key={label} label={label} items={items} />
          ))}
          <section className="giq-panel p-5">
            <h2 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
              Greyhounds
            </h2>
            {results.dogs.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {results.dogs.map((dog) => (
                  <Link key={dog.id} href={`/dogs/${dog.id}`} className="giq-subpanel p-3">
                    <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
                      {dog.name}
                    </p>
                    <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                      {[dog.earBrand, dog.colour, dog.sex, dog.trainer?.name]
                        .filter(Boolean)
                        .join(" · ") || "Greyhound profile"}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyGroup />
            )}
          </section>
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
    <section className="giq-panel p-5">
      <h2 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">{label}</h2>
      {items.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {items.map((actor) => (
            <Link key={actor.id} href={`/p/${actor.handle}`} className="giq-subpanel p-3">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[hsl(var(--foreground))]">
                {actor.displayName}
                {actor.profile?.verified && (
                  <BadgeCheck className="h-3.5 w-3.5 text-[hsl(var(--primary-bright))]" aria-label="Verified" />
                )}
              </p>
              <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                {actor.page?.tagline ?? actor.profile?.state ?? `@${actor.handle}`}
              </p>
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
    <p className="mt-3 text-[12px] text-[hsl(var(--subtle-foreground))]">
      No matches in this group.
    </p>
  );
}
