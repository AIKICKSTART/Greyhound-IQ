import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, RadioTower } from "lucide-react";

import { MeetingDetailRaceCard } from "@/components/meeting-detail-race-card";
import { PageTitle } from "@/components/page-title";
import { RacingDataDisclosure } from "@/components/racing-data-disclosure";
import {
  formatRaceDateInput,
  formatRaceDayLabel,
} from "@/lib/race-time";
import {
  buildMeetingRacePresentation,
  buildMeetingSummary,
} from "@/lib/meeting-presentation";
import { resolveDemoProviderRouteId } from "@/lib/demo-route-samples";
import { getMeetingById } from "@/lib/queries";

export const dynamic = "force-dynamic";

type MeetingPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: MeetingPageProps): Promise<Metadata> {
  const { id: routeId } = await params;
  const id = await resolveDemoProviderRouteId("meeting", routeId);
  const meeting = await getMeetingById(id);
  if (!meeting) return { title: "Meeting not found — GreyhoundIQ" };
  const date = formatRaceDayLabel(formatRaceDateInput(meeting.meetingDate));
  return {
    title: `${meeting.track.name} meeting — ${date} | GreyhoundIQ`,
    description: `Racecard, stored results and replay availability for the ${date} meeting at ${meeting.track.name}, ${meeting.track.state}.`,
    alternates: { canonical: `/meetings/${meeting.id}` },
  };
}

export default async function MeetingPage({ params }: MeetingPageProps) {
  const { id: routeId } = await params;
  const id = await resolveDemoProviderRouteId("meeting", routeId);
  const meeting = await getMeetingById(id);
  if (!meeting) notFound();

  const now = new Date();
  const racePresentations = meeting.races.map((race) => ({
    race,
    presentation: buildMeetingRacePresentation(race, now),
  }));
  const summary = buildMeetingSummary(
    racePresentations.map(({ presentation }) => presentation),
  );
  const dateInput = formatRaceDateInput(meeting.meetingDate);
  const dateLabel = formatRaceDayLabel(dateInput);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-6 flex flex-wrap items-center gap-3 text-[12px]">
        <Link
          href={`/races?date=${dateInput}`}
          className="giq-outline-action min-h-9 px-3 py-2 font-semibold"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Race day
        </Link>
        <Link
          href={`/tracks/${meeting.track.id}`}
          className="font-semibold text-[hsl(var(--primary-light))] hover:underline"
        >
          Open {meeting.track.name} track guide
        </Link>
      </nav>

      <header className="giq-panel overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="program-label">Race meeting</p>
            <PageTitle className="mt-3">
              {meeting.track.name}
            </PageTitle>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-[hsl(var(--muted-foreground))]">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {dateLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {meeting.track.state}
              </span>
              <span>{meeting.meetingType ?? "Race meeting"}</span>
            </p>
          </div>
          <span className="giq-badge giq-badge-purple">
            <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
            Stored meeting record
          </span>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MeetingMetric label="Races" value={summary.races} />
          <MeetingMetric label="Runners" value={summary.runners} />
          <MeetingMetric label="Races with results" value={summary.racesWithResults} />
          <MeetingMetric label="Replays" value={summary.replays} />
        </div>
      </header>

      <RacingDataDisclosure className="mt-6" />

      <section className="mt-8" aria-labelledby="meeting-racecard-title">
        <div className="mb-5">
          <p className="program-label">Meeting racecard</p>
          <h2
            id="meeting-racecard-title"
            className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]"
          >
            Races, results and replays
          </h2>
        </div>

        {racePresentations.length > 0 ? (
          <div className="grid gap-4">
            {racePresentations.map(({ race, presentation }) => (
              <MeetingDetailRaceCard
                key={race.id}
                race={race}
                presentation={presentation}
              />
            ))}
          </div>
        ) : (
          <div className="giq-empty-state p-10 text-center">
            <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
              No race rows are available for this stored meeting.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function MeetingMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="giq-subpanel p-4" data-metric-state="measured">
      <p className="text-2xl font-semibold tabular-nums text-[hsl(var(--foreground))]">
        {value.toLocaleString("en-AU")}
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </p>
    </div>
  );
}
