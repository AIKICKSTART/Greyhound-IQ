import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, PlayCircle, Trophy } from "lucide-react";

import { PageTitle } from "@/components/page-title";
import { RacingDataDisclosure } from "@/components/racing-data-disclosure";
import { getTrainerById } from "@/lib/queries";
import { formatRaceDateTime } from "@/lib/race-time";

export const dynamic = "force-dynamic";

export default async function TrainerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trainer = await getTrainerById(id);
  if (!trainer) notFound();

  const now = new Date();
  const upcoming = trainer.runners
    .filter((runner) => runner.race.raceTime >= now)
    .sort(
      (left, right) =>
        left.race.raceTime.getTime() - right.race.raceTime.getTime(),
    );
  const recent = trainer.runners.filter((runner) => runner.race.raceTime < now);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <RacingDataDisclosure className="mb-6" />
      <p className="program-label">Canonical trainer profile</p>
      <PageTitle>{trainer.name}</PageTitle>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        {[trainer.state, trainer.licenseNumber].filter(Boolean).join(" · ") ||
          "Official trainer identity"}
      </p>

      <section className="giq-panel mt-6 p-5">
        <h2 className="giq-h4">Current dogs</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {trainer.dogs.length ? (
            trainer.dogs.map((dog) => (
              <Link
                key={dog.id}
                href={`/dogs/${dog.id}`}
                className="giq-badge giq-badge-neutral hover:text-[hsl(var(--primary-bright))]"
              >
                {dog.name}
              </Link>
            ))
          ) : (
            <p className="giq-caption">No current canonical dog links.</p>
          )}
        </div>
      </section>

      <RaceList title="Upcoming races" runners={upcoming} />
      <RaceList title="Recent results and replays" runners={recent} />
    </main>
  );
}

type TrainerDetail = NonNullable<Awaited<ReturnType<typeof getTrainerById>>>;

function RaceList({
  title,
  runners,
}: {
  title: string;
  runners: TrainerDetail["runners"];
}) {
  return (
    <section className="giq-panel mt-5 overflow-hidden">
      <div className="border-b border-white/[0.07] p-5">
        <h2 className="giq-h4">{title}</h2>
      </div>
      {runners.length ? (
        <div className="divide-y divide-white/[0.06]">
          {runners.map((runner) => {
            const race = runner.race;
            const hasReplay =
              race.videos.some((video) =>
                ["embedded", "external"].includes(video.playbackState),
              ) || Boolean(race.replayUrl);
            return (
              <article
                key={runner.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/races/${race.id}`}
                      className="font-semibold hover:text-[hsl(var(--primary-bright))]"
                    >
                      {race.meeting.track.name} R{race.raceNumber}
                    </Link>
                    <span className="giq-badge giq-badge-neutral">
                      {race.distance}m
                    </span>
                    {race.grade ? (
                      <span className="giq-badge giq-badge-neutral">
                        {race.grade}
                      </span>
                    ) : null}
                  </div>
                  <p className="giq-caption mt-1 flex flex-wrap items-center gap-2">
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                    {race.meeting.track.state}
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {formatRaceDateTime(race.raceTime)}
                    <Link
                      href={`/dogs/${runner.dog.id}`}
                      className="hover:text-[hsl(var(--primary-bright))]"
                    >
                      {runner.dog.name}
                    </Link>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {runner.result?.finishingPosition ? (
                    <span className="giq-badge giq-badge-gold">
                      <Trophy className="h-3 w-3" aria-hidden="true" />
                      {runner.result.finishingPosition}
                    </span>
                  ) : null}
                  {hasReplay ? (
                    <Link
                      href={`/races/${race.id}`}
                      className="giq-button giq-button-glass min-h-9 px-3 text-xs"
                    >
                      <PlayCircle className="h-4 w-4" aria-hidden="true" />
                      Replay
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="p-5 text-sm text-[hsl(var(--muted-foreground))]">
          No linked races in this window.
        </p>
      )}
    </section>
  );
}
