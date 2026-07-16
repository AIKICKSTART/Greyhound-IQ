import { BookOpen, ChevronRight, LifeBuoy, Search } from "lucide-react";
import Link from "next/link";

import {
  filterOnboardingHelpTours,
  filterSupportHelpTopics,
  getAvailableOnboardingHelpTours,
  normalizeHelpSearchQuery,
} from "./onboarding-help-catalogue";

export function AccountSupportHelpCentre({
  query,
  role,
}: {
  query: string | readonly string[] | null | undefined;
  role: string | null;
}) {
  const normalizedQuery = normalizeHelpSearchQuery(query);
  const topics = filterSupportHelpTopics(normalizedQuery);
  const tours = filterOnboardingHelpTours(
    getAvailableOnboardingHelpTours({ authenticated: true, role }),
    normalizedQuery,
  );

  return (
    <section id="help-topics" className="giq-panel mb-6 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="program-label">Guided help</p>
          <h2 className="mt-2 flex items-center gap-2 text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
            <BookOpen
              className="h-5 w-5 text-[hsl(var(--primary-bright))]"
              aria-hidden="true"
            />
            Help topics and available tours
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
            Search concise product guidance, open the relevant workspace, or
            start any guided tour available to your current role. Tour
            visibility never grants additional access.
          </p>
        </div>
        <Link
          href="/contact"
          className="giq-outline-action w-full shrink-0 sm:w-fit"
        >
          <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
          Open support
        </Link>
      </div>

      <form
        action="/account/support"
        method="get"
        role="search"
        aria-label="Search help topics and guided tours"
        className="mt-5 flex flex-col gap-2 sm:flex-row"
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search help topics and guided tours</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--subtle-foreground))]"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            maxLength={80}
            defaultValue={normalizedQuery}
            placeholder="Search races, billing, privacy, marketplace…"
            className="giq-input min-h-11 w-full pl-10"
          />
        </label>
        <button
          type="submit"
          className="giq-button giq-button-primary min-h-11 px-5 text-[13px] font-semibold"
        >
          Search help
        </button>
        {normalizedQuery ? (
          <Link
            href="/account/support#help-topics"
            className="giq-button giq-button-glass min-h-11 px-4 text-[13px] font-semibold"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <p
        className="mt-3 text-[11px] text-[hsl(var(--subtle-foreground))]"
        aria-live="polite"
      >
        {normalizedQuery
          ? `${topics.length} help topics and ${tours.length} guided tours match “${normalizedQuery}”.`
          : `${topics.length} help topics and ${tours.length} guided tours are available.`}
      </p>

      {topics.length > 0 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {topics.map((topic) => (
            <article key={topic.title} className="giq-subpanel flex flex-col p-4 sm:p-5">
              <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
                {topic.title}
              </h3>
              <p className="mt-2 flex-1 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                {topic.summary}
              </p>
              <Link
                href={topic.href}
                className="giq-text-link mt-4 w-fit text-[12px] font-semibold"
              >
                Open relevant workspace
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="giq-dashed-panel mt-5 px-5 py-8 text-center" role="status">
          <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
            No help topics match this search
          </p>
          <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
            Try a product area such as races, billing, privacy or marketplace,
            or open support for a specific issue.
          </p>
        </div>
      )}

      <details
        className="giq-subpanel mt-5 p-4 sm:p-5"
        open={Boolean(normalizedQuery)}
      >
        <summary className="cursor-pointer text-[14px] font-semibold text-[hsl(var(--foreground))]">
          Available guided tours ({tours.length})
        </summary>
        <p className="mt-2 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
          Opening a route starts or resumes its contextual five-step tour when
          interactive help is enabled. Template routes are started from their
          parent list after selecting a real record.
        </p>
        {tours.length > 0 ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tours.map((tour) => (
              <li key={`${tour.tourId}:${tour.route}`}>
                {tour.href ? (
                  <Link
                    href={tour.href}
                    className="giq-button giq-button-carbon min-h-11 w-full justify-between px-3 text-left text-[12px] font-semibold"
                  >
                    <span className="min-w-0 truncate">{tour.pageLabel}</span>
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                ) : (
                  <span className="flex min-h-11 items-center rounded-xl border border-white/[0.08] px-3 text-[12px] text-[hsl(var(--muted-foreground))]">
                    {tour.pageLabel} · select a record first
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[12px] text-[hsl(var(--muted-foreground))]">
            No available guided tours match this search.
          </p>
        )}
      </details>
    </section>
  );
}
