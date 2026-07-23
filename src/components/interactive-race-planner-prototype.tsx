"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Flag,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

const RACES = [
  { id: "wpk-r5", time: "6:42 pm", countdown: "12 min", track: "Wentworth Park", race: "R5", distance: "520m" },
  { id: "ric-r7", time: "6:58 pm", countdown: "28 min", track: "Richmond", race: "R7", distance: "401m" },
  { id: "dpt-r6", time: "7:14 pm", countdown: "44 min", track: "Dapto", race: "R6", distance: "520m" },
  { id: "alb-r8", time: "7:31 pm", countdown: "61 min", track: "Albion Park", race: "R8", distance: "520m" },
];

const DEFAULT_PLAN = ["wpk-r5", "dpt-r6"];

export function togglePlannedRaceIds(ids: string[], raceId: string) {
  return ids.includes(raceId)
    ? ids.filter((id) => id !== raceId)
    : [...ids, raceId];
}

export function InteractiveRacePlannerPrototype({
  density = "standard",
  mode = "full",
}: {
  density?: "standard" | "compact";
  mode?: "full" | "split" | "integrated";
}) {
  const compact = density === "compact";
  const [plannedIds, setPlannedIds] = useState(DEFAULT_PLAN);
  const plannedRaces = useMemo(
    () => RACES.filter((race) => plannedIds.includes(race.id)),
    [plannedIds]
  );
  const nextRace = plannedRaces[0] ?? null;
  const meetingCount = new Set(plannedRaces.map((race) => race.track)).size;

  if (mode !== "full") {
    return (
      <EmbeddedRacePlanner
        mode={mode}
        plannedIds={plannedIds}
        plannedRaces={plannedRaces}
        nextRace={nextRace}
        onReset={() => setPlannedIds(DEFAULT_PLAN)}
        onToggle={(raceId) =>
          setPlannedIds((current) => togglePlannedRaceIds(current, raceId))
        }
      />
    );
  }

  return (
    <section
      id="race-plan-builder"
      data-review-component="RACE-PLANNER"
      data-planner-density={density}
      className="giq-panel giq-race-planner-prototype mt-4 overflow-hidden scroll-mt-[190px]"
      aria-label="Interactive race planner prototype"
    >
      <div
        className={`flex flex-wrap items-start justify-between border-b border-white/8 ${
          compact ? "gap-3 p-3 sm:p-4" : "gap-4 p-4 sm:p-5"
        }`}
      >
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--secondary-light))]">
            <CalendarDays className="size-4" aria-hidden="true" />
            My race plan · Saturday
          </p>
          <h2
            className={`mt-2 font-semibold text-white ${
              compact ? "text-[18px] sm:text-[20px]" : "text-[20px] sm:text-[24px]"
            }`}
          >
            Build tonight&apos;s run sheet
          </h2>
          <p className="mt-1 text-[12px] text-white/45">
            Add the races you want to follow. Your next event stays at the top.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPlannedIds(DEFAULT_PLAN)}
          className="giq-button giq-button-carbon min-h-11 px-4 text-[12px] font-semibold"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset plan
        </button>
      </div>

      <div className="grid border-b border-white/8 bg-black/20 sm:grid-cols-3">
        <PlannerSummary compact={compact} label="Planned races" value={String(plannedRaces.length)} detail="Tap any race to update" />
        <PlannerSummary compact={compact} label="Meetings" value={String(meetingCount)} detail="Across your selected tracks" />
        <PlannerSummary
          compact={compact}
          label="Next up"
          value={nextRace ? `${nextRace.track} ${nextRace.race}` : "Nothing planned"}
          detail={nextRace ? `${nextRace.countdown} · ${nextRace.distance}` : "Add a race below"}
        />
      </div>

      <div
        className={`grid xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] ${
          compact ? "gap-3 p-3 sm:p-4" : "gap-5 p-4 sm:p-5"
        }`}
      >
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-semibold text-white">Available next races</h3>
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/35">Live order</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {RACES.map((race) => {
              const planned = plannedIds.includes(race.id);
              return (
                <button
                  key={race.id}
                  type="button"
                  aria-label={`${planned ? "Remove" : "Add"} ${race.track} ${race.race} ${race.time}`}
                  aria-pressed={planned}
                  onClick={() =>
                    setPlannedIds((current) =>
                      togglePlannedRaceIds(current, race.id)
                    )
                  }
                  className={`group flex items-center gap-3 rounded-xl border text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))] ${compact ? "min-h-14 p-2.5" : "min-h-16 p-3"} ${
                    planned
                      ? "border-[hsl(var(--primary-light)/0.42)] bg-[hsl(var(--primary)/0.14)]"
                      : "border-white/8 bg-white/[0.025] hover:border-white/16 hover:bg-white/[0.045]"
                  }`}
                >
                  <span className={`grid size-11 shrink-0 place-items-center rounded-lg text-[12px] font-bold ${planned ? "bg-[hsl(var(--primary)/0.28)] text-[hsl(var(--primary-light))]" : "bg-white/[0.06] text-white/55"}`}>
                    {race.race}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[13px] text-white">{race.track}</strong>
                    <small className="mt-0.5 flex items-center gap-1 text-[10px] text-white/42">
                      <Clock3 className="size-3" aria-hidden="true" />
                      {race.time} · {race.distance} · {race.countdown}
                    </small>
                  </span>
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full ${planned ? "bg-[hsl(var(--primary))] text-white" : "border border-white/12 text-white/45"}`}>
                    {planned ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Flag className="size-4 text-[hsl(var(--secondary-light))]" aria-hidden="true" />
            <h3 className="text-[13px] font-semibold text-white">Your ordered plan</h3>
          </div>
          <div className="space-y-2">
            {plannedRaces.map((race, index) => (
              <div key={race.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-white/8 bg-black/18 px-3 py-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[hsl(var(--secondary)/0.14)] text-[10px] font-bold text-[hsl(var(--secondary-light))]">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[12px] text-white">{race.track} · {race.race}</strong>
                  <small className="text-[10px] text-white/38">{race.time} · {race.countdown}</small>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${race.track} ${race.race} from plan`}
                  onClick={() =>
                    setPlannedIds((current) =>
                      togglePlannedRaceIds(current, race.id)
                    )
                  }
                  className="grid size-10 place-items-center rounded-lg text-white/35 transition hover:bg-red-400/10 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {plannedRaces.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-[11px] text-white/38">
                Add a race to start your plan.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function EmbeddedRacePlanner({
  mode,
  plannedIds,
  plannedRaces,
  nextRace,
  onReset,
  onToggle,
}: {
  mode: "split" | "integrated";
  plannedIds: string[];
  plannedRaces: (typeof RACES)[number][];
  nextRace: (typeof RACES)[number] | null;
  onReset: () => void;
  onToggle: (raceId: string) => void;
}) {
  return (
    <section
      data-review-component="RACE-PLANNER"
      data-planner-mode={mode}
      className="giq-embedded-race-planner h-full"
      aria-label={`Interactive ${mode} race planner prototype`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 p-4 sm:p-5">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--secondary-light))]">
            <CalendarDays className="size-4" aria-hidden="true" />
            Live planner
          </p>
          <h2 className="mt-2 text-[19px] font-semibold text-white sm:text-[22px]">
            Your next 75 minutes
          </h2>
          <p className="mt-1 text-[11px] text-white/42">
            {plannedRaces.length} planned · Next {nextRace ? `${nextRace.track} ${nextRace.race}` : "race not selected"}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="giq-button giq-button-carbon min-h-10 px-3 text-[11px] font-semibold"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset
        </button>
      </header>

      <div
        className={`grid gap-2 p-4 sm:p-5 ${
          mode === "integrated" ? "sm:grid-cols-2 xl:grid-cols-4" : ""
        }`}
      >
        {RACES.map((race) => {
          const planned = plannedIds.includes(race.id);
          return (
            <button
              key={race.id}
              type="button"
              aria-label={`${planned ? "Remove" : "Add"} ${race.track} ${race.race} ${race.time}`}
              aria-pressed={planned}
              onClick={() => onToggle(race.id)}
              className={`group grid min-h-14 grid-cols-[42px_minmax(0,1fr)_36px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))] ${
                planned
                  ? "border-[hsl(var(--primary-light)/0.46)] bg-[hsl(var(--primary)/0.16)]"
                  : "border-white/8 bg-black/16 hover:border-white/18 hover:bg-white/[0.04]"
              }`}
            >
              <span className={`grid size-10 place-items-center rounded-lg text-[12px] font-bold ${planned ? "bg-[hsl(var(--primary)/0.30)] text-[hsl(var(--primary-light))]" : "bg-white/[0.055] text-white/48"}`}>
                {race.race}
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-[12px] text-white">{race.track}</strong>
                <small className="mt-0.5 block truncate text-[10px] text-white/40">
                  {race.time} · {race.distance} · {race.countdown}
                </small>
              </span>
              <span className={`grid size-9 place-items-center rounded-full ${planned ? "bg-[hsl(var(--primary))] text-white" : "border border-white/12 text-white/40"}`}>
                {planned ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>

      <footer className="flex min-h-12 flex-wrap items-center gap-2 border-t border-white/8 px-4 py-2.5 sm:px-5">
        <span className="mr-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/32">
          Run sheet
        </span>
        {plannedRaces.map((race, index) => (
          <button
            key={race.id}
            type="button"
            onClick={() => onToggle(race.id)}
            aria-label={`Remove ${race.track} ${race.race} from plan`}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/9 bg-white/[0.035] px-2.5 text-[10px] font-semibold text-white/62 transition hover:border-red-300/25 hover:text-red-200"
          >
            <span className="text-[hsl(var(--secondary-light))]">{index + 1}</span>
            {race.track} {race.race}
          </button>
        ))}
        {plannedRaces.length === 0 && (
          <span className="text-[10px] text-white/35">Choose a race above.</span>
        )}
      </footer>
    </section>
  );
}

function PlannerSummary({
  label,
  value,
  detail,
  compact = false,
}: {
  label: string;
  value: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <div className={`border-b border-white/8 sm:border-b-0 sm:border-r last:border-r-0 ${compact ? "p-3" : "p-4"}`}>
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">{label}</span>
      <strong className="mt-1 block truncate text-[16px] text-white">{value}</strong>
      <small className="text-[10px] text-white/38">{detail}</small>
    </div>
  );
}
