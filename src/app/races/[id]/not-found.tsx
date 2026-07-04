import Link from "next/link";
import { CalendarDays, Search } from "lucide-react";

export default function RaceNotFound() {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-6 py-14">
      <section className="giq-panel w-full p-8 text-center">
        <span className="giq-badge giq-badge-neutral">
          <CalendarDays className="h-3.5 w-3.5" />
          Race not found
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-[hsl(var(--foreground))]">
          This race is not in the archive.
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[hsl(var(--muted-foreground))]">
          The race may have moved, been merged into another provider record, or
          not been harvested yet.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/races"
            className="giq-button giq-button-primary px-5 text-[13px] font-semibold"
          >
            <Search className="h-4 w-4" />
            Search races
          </Link>
          <Link
            href="/"
            className="giq-button giq-button-glass px-5 text-[13px] font-semibold"
          >
            Today&apos;s race cards
          </Link>
        </div>
      </section>
    </main>
  );
}
