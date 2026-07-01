import { DogSearch } from "@/components/dog-search";
import { PageHero } from "@/components/page-hero";
import { Search } from "lucide-react";

export const metadata = {
  title: "Dog Search — GreyhoundIQ",
  description: "Search the national database for any greyhound by name. Get full career form, pedigree, and trainer info.",
};

export default function DogsPage() {
  return (
    <div className="fade-in">
      <PageHero
        image="/images/wentworth-track-hero.webp"
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
      </section>
    </div>
  );
}
