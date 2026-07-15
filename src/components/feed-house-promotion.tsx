import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

import type { PrototypeVariant } from "@/components/prototype-variants";

export type FeedHousePromotionVariant = "compact" | "billboard";

const PROMOTIONS = {
  compact: {
    image: "/images/feed/greyhoundiq-house-feed-ad.webp",
    heading: "Turn race night into a clear decision.",
    body: "Live form, dog profiles, and marketplace context in one workspace.",
    href: "/pricing",
    action: "Explore GreyhoundIQ Pro",
  },
  billboard: {
    image: "/images/feed/greyhoundiq-race-night-billboard.webp",
    heading: "One race night. Every signal.",
    body: "Plan the card, track the dogs, and keep the community conversation in view.",
    href: "/races",
    action: "Open tonight's races",
  },
} as const;

export function FeedHousePromotion({
  variant,
}: {
  variant: FeedHousePromotionVariant;
}) {
  const promotion = PROMOTIONS[variant];
  const billboard = variant === "billboard";

  return (
    <aside
      aria-label="GreyhoundIQ house promotion"
      data-feed-house-promotion={variant}
      className={`giq-panel relative isolate overflow-hidden p-0 ${
        billboard
          ? "min-h-[220px] lg:aspect-[16/5]"
          : "min-h-[240px] lg:aspect-[16/7]"
      }`}
    >
      <Image
        src={promotion.image}
        alt=""
        fill
        sizes={billboard ? "(min-width: 1280px) 1080px, 100vw" : "(min-width: 1280px) 760px, 100vw"}
        className="object-cover object-center"
      />
      <div
        aria-hidden="true"
        className={`absolute inset-0 ${
          billboard
            ? "bg-gradient-to-r from-black/95 via-black/68 to-black/10"
            : "bg-gradient-to-r from-black/95 via-black/72 to-black/25"
        }`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" aria-hidden="true" />

      <div
        className={`relative z-10 flex h-full min-h-[inherit] flex-col justify-between gap-5 ${
          billboard ? "p-5 sm:p-7" : "p-5 sm:p-6"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            aria-label="GreyhoundIQ"
            className="inline-flex items-center gap-2 text-[13px] font-black tracking-[-0.02em] text-white"
          >
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg border border-[hsl(var(--primary-light)/0.48)] bg-[hsl(var(--primary)/0.32)] text-[10px] tracking-[0.08em] text-[hsl(var(--primary-light))] shadow-[0_0_24px_hsl(var(--primary)/0.28)]"
            >
              GIQ
            </span>
            GreyhoundIQ
          </span>
          <span className="rounded-full border border-white/12 bg-black/45 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white/58 backdrop-blur-sm">
            GreyhoundIQ house promotion
          </span>
        </div>

        <div className={billboard ? "max-w-xl" : "max-w-md"}>
          <h2
            className={`font-semibold tracking-[-0.025em] text-white ${
              billboard ? "text-[25px] sm:text-[34px]" : "text-[22px] sm:text-[28px]"
            }`}
          >
            {promotion.heading}
          </h2>
          <p className="mt-2 max-w-lg text-[12px] leading-5 text-white/66 sm:text-[13px]">
            {promotion.body}
          </p>
          <Link
            href={promotion.href}
            className="giq-button giq-button-gold mt-4 min-h-11 w-fit px-4 text-[11px] font-bold"
          >
            {promotion.action}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

export type FeedAdvertiserConceptBrand =
  | "ladbrokes"
  | "tab"
  | "sportsbet"
  | "bet365";

type FeedAdvertiserConceptPlacement = "compact" | "billboard";

const ADVERTISER_CONCEPTS = {
  ladbrokes: {
    name: "Ladbrokes",
    eyebrow: "Race-night placement concept",
    heading: "The form guide keeps moving.",
    body: "A bold transition panel for the decision window between fields, form and replay.",
    surface:
      "border-[#ff3b4d]/48 bg-[radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.18),transparent_24%),linear-gradient(118deg,#3b0508_0%,#a90818_50%,#e71d32_100%)]",
    wordmark: "bg-white text-[#c70b1c]",
  },
  tab: {
    name: "TAB",
    eyebrow: "Meeting hub placement concept",
    heading: "Stay with the rhythm of the meeting.",
    body: "A restrained race-hub billboard designed to sit naturally between analysis and results.",
    surface:
      "border-[#64da9a]/42 bg-[radial-gradient(circle_at_82%_18%,rgba(120,255,183,0.17),transparent_26%),linear-gradient(118deg,#031c13_0%,#074e32_52%,#087e4d_100%)]",
    wordmark: "bg-white text-[#087748]",
  },
  sportsbet: {
    name: "Sportsbet",
    eyebrow: "Live-feed placement concept",
    heading: "Race night, framed in motion.",
    body: "A high-energy feed break built for fast scanning without competing with form or community content.",
    surface:
      "border-[#4b8cff]/48 bg-[radial-gradient(circle_at_84%_16%,rgba(255,51,76,0.28),transparent_27%),linear-gradient(118deg,#06183e_0%,#0b48a2_55%,#113b86_100%)]",
    wordmark: "bg-[#ef2645] text-white",
  },
  bet365: {
    name: "bet365",
    eyebrow: "Premium billboard concept",
    heading: "Every meeting has a rhythm.",
    body: "A composed race-night placement that keeps the brand clear and the surrounding racing signals legible.",
    surface:
      "border-[#f7dc4b]/42 bg-[radial-gradient(circle_at_84%_18%,rgba(247,220,75,0.2),transparent_26%),linear-gradient(118deg,#021b14_0%,#07533d_54%,#08795b_100%)]",
    wordmark: "bg-[#f4dc43] text-[#064b38]",
  },
} as const;

const ADVERTISER_CONCEPTS_BY_VARIANT = {
  A1: { compact: "ladbrokes", billboard: "tab" },
  A2: { compact: "sportsbet", billboard: "bet365" },
  B1: { compact: "tab", billboard: "sportsbet" },
  B2: { compact: "bet365", billboard: "ladbrokes" },
  C1: { compact: "sportsbet", billboard: "tab" },
  C2: { compact: "ladbrokes", billboard: "bet365" },
} as const satisfies Record<
  PrototypeVariant,
  Record<FeedAdvertiserConceptPlacement, FeedAdvertiserConceptBrand>
>;

export function getFeedAdvertiserConcepts(variant: PrototypeVariant) {
  return ADVERTISER_CONCEPTS_BY_VARIANT[variant];
}

export function FeedAdvertiserConcept({
  brand,
  placement,
}: {
  brand: FeedAdvertiserConceptBrand;
  placement: FeedAdvertiserConceptPlacement;
}) {
  const concept = ADVERTISER_CONCEPTS[brand];
  const billboard = placement === "billboard";

  return (
    <aside
      aria-label={`${concept.name} demo advertiser concept`}
      data-feed-advertiser-concept={brand}
      data-advertiser-placement={placement}
      className={`relative isolate overflow-hidden rounded-2xl border shadow-[0_22px_70px_rgba(0,0,0,0.34)] ${concept.surface} ${
        billboard ? "min-h-[250px] lg:aspect-[16/5]" : "min-h-[220px]"
      }`}
    >
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-20 size-64 rounded-full border-[38px] border-white/[0.07]"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-20 right-16 size-52 rotate-12 rounded-[38%] border-[28px] border-black/10"
      />

      <div
        className={`relative z-10 flex min-h-[inherit] flex-col justify-between gap-5 ${
          billboard ? "p-5 sm:p-7" : "p-5 sm:p-6"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            aria-label={`${concept.name} text-only brand treatment`}
            className={`inline-flex min-h-10 items-center rounded-lg px-3 text-[16px] font-black tracking-[-0.04em] shadow-lg ${concept.wordmark}`}
          >
            {concept.name}
          </span>
          <span className="rounded-full border border-white/20 bg-black/34 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/86 backdrop-blur-sm">
            Demo advertiser concept · Not a paid partnership
          </span>
        </div>

        <div className={billboard ? "max-w-2xl" : "max-w-xl"}>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/65">
            {concept.eyebrow}
          </p>
          <h2
            className={`mt-2 font-semibold tracking-[-0.035em] text-white ${
              billboard
                ? "text-[26px] leading-[1.05] sm:text-[38px]"
                : "text-[23px] leading-tight sm:text-[30px]"
            }`}
          >
            {concept.heading}
          </h2>
          <p className="mt-2 max-w-xl text-[12px] leading-5 text-white/72 sm:text-[13px]">
            {concept.body}
          </p>
          <details className="group mt-4 w-fit max-w-full rounded-xl border border-white/18 bg-black/24 text-white backdrop-blur-sm open:bg-black/38">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-[11px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              View concept notes
              <ChevronDown
                className="size-4 transition group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="max-w-md border-t border-white/14 px-4 py-3 text-[10px] leading-5 text-white/68">
              Text-only brand treatment for visual review. Concept interaction only — no wagering action is available.
            </p>
          </details>
        </div>

        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/62">
          18+ · Gamble responsibly · Creative requires partner and legal approval
        </p>
      </div>
    </aside>
  );
}
