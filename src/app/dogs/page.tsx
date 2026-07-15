import { DogSearch } from "@/components/dog-search";
import { PageHero } from "@/components/page-hero";
import { RacingDataDisclosure } from "@/components/racing-data-disclosure";
import { getDogSearchTallies } from "@/lib/queries";
import { directorySearchQuerySchema } from "@/lib/query-validation";
import { formatRaceMetric } from "@/lib/race-metric";
import { Search } from "lucide-react";

export const metadata = {
  title: "Dog Search — GreyhoundIQ",
  description: "Search the national database for any greyhound by name. Get full career form, pedigree, and trainer info.",
  alternates: { canonical: "/dogs" },
  openGraph: {
    title: "Dog Search — GreyhoundIQ",
    description: "Search the national database for any greyhound by name. Get full career form, pedigree, and trainer info.",
    url: "/dogs",
    type: "website",
  },
};

export default async function DogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawQuery = await searchParams;
  const parsedQuery = directorySearchQuerySchema.safeParse({ q: rawQuery.q });
  const initialQuery = parsedQuery.success ? parsedQuery.data.q : "";
  const tallies = await getDogSearchTallies();
  const stats = [
    { label: "Greyhounds", value: formatRaceMetric(tallies.dogs) },
    { label: "Races", value: formatRaceMetric(tallies.races) },
    { label: "Results", value: formatRaceMetric(tallies.results) },
  ];

  return (
    <div>
      <PageHero
        image="/images/hero-breaking-from-boxes.webp"
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
        <RacingDataDisclosure className="mb-8" />
        <DogSearch initialQuery={initialQuery} />
        <div className="mt-8 grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="giq-glass-panel p-4 text-center"
              data-metric-state={stat.value.state}
            >
              <div className="text-xl md:text-2xl font-semibold tabular-nums tracking-[-0.02em] text-[hsl(var(--foreground))]">
                {stat.value.text}
              </div>
              <div className="mt-1 text-[12px] text-[hsl(var(--subtle-foreground))] tracking-[-0.013em]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-[hsl(var(--subtle-foreground))]">
          PostgreSQL planner estimates. Unavailable totals are never replaced
          with zero.
        </p>
      </section>
    </div>
  );
}
