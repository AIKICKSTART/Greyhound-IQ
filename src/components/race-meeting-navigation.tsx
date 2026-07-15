import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

type RaceNavigationTarget = {
  id: string;
  raceNumber: number;
  distance: number;
  href: string;
};

export function RaceMeetingNavigation({
  previous,
  next,
  position,
  total,
  meetingHref,
  trackName,
}: {
  previous: RaceNavigationTarget | null;
  next: RaceNavigationTarget | null;
  position: number | null;
  total: number;
  meetingHref: string;
  trackName: string;
}) {
  return (
    <nav
      aria-label="Meeting race navigation"
      className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch"
    >
      {previous ? (
        <Link
          href={previous.href}
          aria-label={`Previous race, Race ${previous.raceNumber}`}
          className="giq-panel flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:border-[hsl(var(--primary)/0.32)] hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>
            <span className="program-label block">Previous race</span>
            <span className="mt-1 block text-sm font-semibold text-[hsl(var(--foreground))]">
              Race {previous.raceNumber} / {previous.distance}m
            </span>
          </span>
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="giq-panel flex min-h-16 items-center gap-3 px-4 py-3 text-[hsl(var(--muted-foreground))] opacity-65"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="text-sm">First race in meeting</span>
        </span>
      )}

      <Link
        href={meetingHref}
        className="giq-panel flex min-h-16 min-w-40 flex-col items-center justify-center px-4 py-3 text-center transition-colors hover:border-[hsl(var(--primary)/0.32)] hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
      >
        <span className="program-label">{trackName}</span>
        <span className="mt-1 text-sm font-semibold text-[hsl(var(--foreground))]">
          {position ? `Race ${position} of ${total}` : `${total} meeting races`}
        </span>
      </Link>

      {next ? (
        <Link
          href={next.href}
          aria-label={`Next race, Race ${next.raceNumber}`}
          className="giq-panel flex min-h-16 items-center justify-end gap-3 px-4 py-3 text-right transition-colors hover:border-[hsl(var(--primary)/0.32)] hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
        >
          <span>
            <span className="program-label block">Next race</span>
            <span className="mt-1 block text-sm font-semibold text-[hsl(var(--foreground))]">
              Race {next.raceNumber} / {next.distance}m
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="giq-panel flex min-h-16 items-center justify-end gap-3 px-4 py-3 text-right text-[hsl(var(--muted-foreground))] opacity-65"
        >
          <span className="text-sm">Last race in meeting</span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        </span>
      )}
    </nav>
  );
}
