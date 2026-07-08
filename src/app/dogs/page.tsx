import { DogSearch } from "@/components/dog-search";
import { PageHero } from "@/components/page-hero";
import { getDogSearchTallies } from "@/lib/queries";
import { Search } from "lucide-react";

export const metadata = {
  title: "Dog Search — GreyhoundIQ",
  description: "Search the national database for any greyhound by name. Get full career form, pedigree, and trainer info.",
};

function formatTally(value: number): string {
  return value.toLocaleString("en-AU");
}

export default async function DogsPage() {
  const tallies = await getDogSearchTallies();
  const stats = [
    { label: "Greyhounds", value: tallies.dogs },
    { label: "Races", value: tallies.races },
    { label: "Results", value: tallies.results },
  ];

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        badge="DOG SEARCH"
        badgeIcon={<Search className="h-3 w-3 text-[hsl(var(--primary-bright))]" />}
        badgeColor="primary"
        title={
          <>
            Find any greyhound.
            <br />
            <span className="gradient-text">Full history.</span>
          </>
        }
        subtitle="Search the national database by name, ear brand, or trainer. Get full career form, pedigree, and stats."
      />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <DogSearch />
        <div className="mt-8 grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="giq-glass-panel p-4 text-center">
              <div className="text-xl md:text-2xl font-semibold tabular-nums tracking-[-0.02em] text-[hsl(var(--foreground))]">
                {formatTally(stat.value)}
              </div>
              <div className="mt-1 text-[12px] text-[hsl(var(--subtle-foreground))] tracking-[-0.013em]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-[hsl(var(--subtle-foreground))]">
          Approximate database totals, updated periodically.
        </p>
      </section>
    </div>
  );
}
