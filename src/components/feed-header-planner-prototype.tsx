import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  Sparkles,
} from "lucide-react";

import { PrototypeSwitcher } from "@/components/prototype-switcher";
import type { PrototypeVariant } from "@/components/prototype-variants";
import { InteractiveRacePlannerPrototype } from "@/components/interactive-race-planner-prototype";

// Three throwaway logged-in Feed header variants, switchable via ?variant=.

const PLANNER_RACES = [
  { time: "6:42 pm", track: "Wentworth Park", race: "R5", distance: "520m" },
  { time: "6:58 pm", track: "Richmond", race: "R7", distance: "401m" },
  { time: "7:14 pm", track: "Dapto", race: "R6", distance: "520m" },
];

const SOCIAL_RIBBON_METRICS = [
  { label: "Friends trackside", value: "7", detail: "Richmond + Dapto" },
  { label: "Active circles", value: "12", detail: "4 new discussions" },
  { label: "Followed updates", value: "18", detail: "Since your last visit" },
  { label: "Unread chat", value: "5", detail: "2 friends online" },
  { label: "Saved listings", value: "3", detail: "1 new match" },
] as const;

export function FeedHeaderPlannerPrototype({
  variant,
  firstName,
}: {
  variant: PrototypeVariant;
  firstName: string;
}) {
  return (
    <>
      {variant.startsWith("A") && (
        <CommandBanner firstName={firstName} compact={variant === "A2"} />
      )}
      {variant === "B1" && <SplitPlanner firstName={firstName} />}
      {variant === "B2" && <IntegratedPlanner firstName={firstName} />}
      {variant.startsWith("C") && (
        <SocialDataRibbon
          firstName={firstName}
          mode={variant === "C2" ? "compact" : "expanded"}
        />
      )}
      <PrototypeSwitcher current={variant} />
    </>
  );
}

function CommandBanner({
  firstName,
  compact,
}: {
  firstName: string;
  compact: boolean;
}) {
  return (
    <section data-template-hero className="relative isolate overflow-hidden rounded-[24px] border border-white/15 bg-[hsl(var(--surface-2))] shadow-[0_24px_70px_hsl(0_0%_0%/0.35)]">
      <div
        className={`relative overflow-hidden ${
          compact
            ? "min-h-[220px] sm:min-h-[250px]"
            : "min-h-[300px] sm:min-h-[340px]"
        }`}
      >
        <Image
          src="/images/wentworth-gate-hero.webp"
          alt="Greyhounds racing under lights"
          fill
          priority
          className="object-cover object-center"
          sizes="(min-width: 1024px) 96vw, 100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--surface-1)/0.95)_0%,hsl(var(--surface-1)/0.66)_42%,hsl(var(--surface-1)/0.12)_78%),linear-gradient(0deg,hsl(var(--surface-1)/0.92)_0%,transparent_52%)]" />
        <div
          className={`relative z-10 flex max-w-3xl flex-col justify-center px-5 sm:px-10 lg:px-14 ${
            compact
              ? "min-h-[220px] py-7 sm:min-h-[250px]"
              : "min-h-[300px] py-10 sm:min-h-[340px]"
          }`}
        >
          <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[hsl(var(--secondary-light))]">
            <Sparkles className="size-4" aria-hidden="true" />
            Race day command
          </p>
          <h1
            className={`font-display max-w-2xl leading-[0.96] tracking-[-0.045em] text-white ${
              compact
                ? "text-[clamp(1.8rem,4vw,3.25rem)]"
                : "text-[clamp(2rem,5vw,4.4rem)]"
            }`}
          >
            Your racing day,
            <br />
            <span className="giq-text-gold-glass">planned at a glance.</span>
          </h1>
          <p className={`${compact ? "mt-3" : "mt-5"} max-w-xl text-[14px] leading-6 text-white/72 sm:text-[16px]`}>
            Welcome back, {firstName}. Live race cards, watched runners and the
            latest results are ready.
          </p>
          <div className={`${compact ? "mt-4" : "mt-7"} flex flex-wrap gap-3`}>
            <Link
              href="/races"
              className="giq-button giq-button-primary px-5 text-[13px] font-semibold"
            >
              Open race planner
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/results"
              className="giq-button giq-button-carbon px-5 text-[13px] font-semibold"
            >
              Latest results
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-20 grid border-t border-white/10 bg-black/45 backdrop-blur-xl sm:grid-cols-2 xl:grid-cols-4">
        <PlannerMetric label="Next race" value="WPK · R5" detail="12 min · 520m" />
        <PlannerMetric label="Meetings today" value="14" detail="NSW, VIC, QLD" />
        <PlannerMetric label="Watched runners" value="3" detail="2 racing tonight" />
        <PlannerMetric label="Results in" value="86" detail="Updated live" />
      </div>

      <div className={`${compact ? "hidden lg:block" : ""} border-t border-white/10 px-4 py-4 sm:px-6`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--secondary-light))]">
              Today&apos;s planner
            </p>
            <h2 className="mt-1 text-[16px] font-semibold text-white">Next on track</h2>
          </div>
          <Link href="/races" className="text-[12px] font-semibold text-[hsl(var(--primary-light))]">
            Full race card
          </Link>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {PLANNER_RACES.map((race) => (
            <RacePlannerItem key={`${race.track}-${race.race}`} {...race} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SplitPlanner({ firstName }: { firstName: string }) {
  return (
    <section
      data-template-hero
      data-template-planner-placement="split"
      className="grid overflow-hidden rounded-[20px] border border-white/15 bg-[hsl(var(--surface-2))] shadow-[0_24px_70px_hsl(0_0%_0%/0.35)] lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)]"
    >
      <div className="relative isolate min-h-[360px] overflow-hidden p-6 sm:p-9">
        <Image
          src="/images/wentworth-gate-hero.webp"
          alt="Greyhound race starting boxes"
          fill
          priority
          className="-z-20 object-cover object-center"
          sizes="(min-width: 1024px) 58vw, 100vw"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--surface-1)/0.96),hsl(var(--surface-1)/0.38)),linear-gradient(0deg,hsl(var(--surface-1)/0.80),transparent)]" />
        <div className="flex h-full flex-col justify-between gap-12">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--secondary-light))]">
            <CalendarDays className="size-4" aria-hidden="true" />
            B1 · Split race operations
          </div>
          <div>
            <p className="mb-2 text-[14px] text-white/65">Good evening, {firstName}</p>
            <h1 className="font-display max-w-xl text-[clamp(2.1rem,4vw,3.9rem)] leading-[0.98] tracking-[-0.04em] text-white">
              The tracks that matter,
              <br />
              <span className="giq-text-purple-glass">in one run sheet.</span>
            </h1>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[linear-gradient(160deg,hsl(var(--surface-3)),hsl(var(--surface-1)))] lg:border-l lg:border-t-0">
        <InteractiveRacePlannerPrototype mode="split" />
      </div>
    </section>
  );
}

function IntegratedPlanner({ firstName }: { firstName: string }) {
  return (
    <section
      data-template-hero
      data-template-planner-placement="integrated"
      className="overflow-hidden rounded-[22px] border border-[hsl(var(--secondary)/0.24)] bg-[hsl(var(--surface-2))] shadow-[0_24px_70px_hsl(0_0%_0%/0.35)]"
    >
      <div className="relative isolate min-h-[250px] overflow-hidden px-6 py-8 sm:px-10 lg:px-12">
        <Image
          src="/images/wentworth-gate-hero.webp"
          alt="Greyhounds racing from the starting boxes"
          fill
          priority
          className="-z-20 object-cover object-[center_45%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--surface-1)/0.97)_0%,hsl(var(--surface-1)/0.72)_48%,hsl(var(--surface-1)/0.18)_100%),linear-gradient(0deg,hsl(var(--surface-1)/0.86),transparent_62%)]" />
        <div className="flex min-h-[186px] flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--secondary-light))]">
              <Sparkles className="size-4" aria-hidden="true" />
              B2 · Integrated race workspace
            </p>
            <p className="mt-4 text-[13px] text-white/58">Welcome back, {firstName}</p>
            <h1 className="font-display mt-2 max-w-3xl text-[clamp(2rem,4vw,3.8rem)] leading-[0.98] tracking-[-0.04em] text-white">
              Plan, follow and review
              <br />
              <span className="giq-text-gold-glass">without leaving the workspace.</span>
            </h1>
          </div>
          <div className="grid w-full max-w-[330px] grid-cols-2 gap-2">
            <PlannerMetric label="Live meetings" value="14" detail="Across Australia" />
            <PlannerMetric label="Watchlist" value="3" detail="Racing tonight" />
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 bg-[linear-gradient(180deg,hsl(var(--surface-3)/0.96),hsl(var(--surface-1)))]">
        <InteractiveRacePlannerPrototype mode="integrated" />
      </div>
    </section>
  );
}

function SocialDataRibbon({
  firstName,
  mode,
}: {
  firstName: string;
  mode: "expanded" | "compact";
}) {
  const compact = mode === "compact";

  return (
    <section
      data-template-hero
      data-social-hub-mode={mode}
      className="overflow-hidden rounded-[20px] border border-white/15 bg-[hsl(var(--surface-1))] shadow-[0_20px_60px_hsl(0_0%_0%/0.32)]"
    >
      <div className={`relative isolate overflow-hidden px-5 sm:px-8 ${compact ? "min-h-[158px] py-5" : "min-h-[210px] py-7"}`}>
        <Image
          src="/images/wentworth-gate-hero.webp"
          alt="Greyhounds racing at Wentworth Park"
          fill
          priority
          className="-z-20 object-cover object-[center_42%]"
          sizes="(min-width: 1024px) 96vw, 100vw"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--surface-1)/0.96)_0%,hsl(var(--surface-1)/0.60)_58%,hsl(var(--surface-1)/0.18)_100%)]" />
        <div className={`flex flex-col justify-between sm:flex-row sm:items-end ${compact ? "min-h-[118px] gap-4" : "min-h-[156px] gap-8"}`}>
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--secondary-light))]">
              {compact
                ? "C2 · Compact Social Data Hub"
                : "C1 · Expanded Social Data Hub"}
            </p>
            <h1 className={`font-display leading-none tracking-[-0.04em] text-white ${compact ? "text-[clamp(1.7rem,3vw,2.8rem)]" : "text-[clamp(2rem,4vw,3.7rem)]"}`}>
              {compact ? (
                <>
                  Community signals,
                  <br />
                  <span className="giq-text-gold-glass">at a glance.</span>
                </>
              ) : (
                <>
                  Your racing network,
                  <br />
                  <span className="giq-text-purple-glass">live.</span>
                </>
              )}
            </h1>
            <p className="mt-3 text-[14px] text-white/65">
              Welcome back, {firstName}. 7 friends trackside · 12 circles active ·
              18 followed updates.
            </p>
          </div>
          <Link
            href={compact ? "/pulse" : "/groups"}
            className="giq-button giq-button-primary w-fit px-5 text-[13px] font-semibold"
          >
            {compact ? "Open messages" : "Open circles"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-white/10 bg-[linear-gradient(90deg,hsl(var(--surface-3)),hsl(var(--surface-2)))] sm:grid-cols-3 xl:grid-cols-5">
        {SOCIAL_RIBBON_METRICS.map((metric) => (
          <div
            key={metric.label}
            className={`min-w-0 border-b border-r border-white/8 last:border-r-0 xl:border-b-0 ${compact ? "p-3" : "p-4"}`}
          >
            <span className="block truncate text-[9px] font-bold uppercase tracking-[0.16em] text-white/38">
              {metric.label}
            </span>
            <strong className={`mt-1 block text-[hsl(var(--primary-light))] ${compact ? "text-[17px]" : "text-[21px]"}`}>
              {metric.value}
            </strong>
            <small className="block truncate text-[10px] text-white/40">
              {metric.detail}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlannerMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-b border-white/8 p-4 sm:border-r xl:border-b-0 last:border-r-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{label}</span>
      <strong className="mt-1 block text-[19px] text-white">{value}</strong>
      <small className="text-[11px] text-white/45">{detail}</small>
    </div>
  );
}

function RacePlannerItem({ time, track, race, distance }: (typeof PLANNER_RACES)[number]) {
  return (
    <Link
      href="/races"
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] p-3 transition hover:border-[hsl(var(--primary)/0.40)] hover:bg-[hsl(var(--primary)/0.08)]"
    >
      <span className="grid size-10 place-items-center rounded-lg bg-[hsl(var(--primary)/0.16)] text-[12px] font-bold text-[hsl(var(--primary-light))]">{race}</span>
      <span className="min-w-0">
        <strong className="block truncate text-[13px] text-white">{track}</strong>
        <small className="flex items-center gap-1 text-[11px] text-white/45">
          <Clock3 className="size-3" aria-hidden="true" />
          {time} · {distance}
        </small>
      </span>
      <ChevronRight className="size-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-[hsl(var(--primary-light))]" aria-hidden="true" />
    </Link>
  );
}
