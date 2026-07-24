import { getTodaysMeetings } from "@/lib/queries";
import { MeetingCard } from "@/components/meeting-card";
import { HomeHero } from "@/components/home-hero";
import { formatLongRaceDayLabel } from "@/lib/race-time";
import { getPricingContent } from "@/lib/site-content";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { siteAssetUrl } from "@/lib/storage-paths";
import { Skeleton, SkeletonGroup, SkeletonPanel } from "@/components/skeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    image: "/images/feature-full-career-form-20260725.webp",
    title: "Full Career Form",
    description:
      "Every start, every time, every track. Complete career history with sectionals and split times.",
    href: "/dogs",
    link: "Explore Form",
    tone: "primary",
  },
  {
    image: "/images/feature-ai-predictions-20260725.webp",
    title: "AI Predictions",
    description:
      "Machine learning race predictions with probability modelling and confidence intervals.",
    href: "/agents",
    link: "View Predictions",
    tone: "info",
  },
  {
    image: "/images/feature-pedigree-tools-20260725.webp",
    title: "Breeding Analytics",
    description:
      "5-generation pedigrees, testmating tools, sire strike rates, and litter performance.",
    href: "/breeding",
    link: "Analyse Breeding",
    tone: "secondary",
  },
  {
    image: "/images/feature-advanced-stats-20260725.webp",
    title: "Advanced Stats",
    description:
      "Track bias, box statistics, trainer leaderboards, speed maps, and custom dashboards.",
    href: "/statistics",
    link: "View Stats",
    tone: "success",
  },
] as const;

export default function HomePage() {
  return (
    <div className="giq-home-page">
      <HomeHero />

      <section
        className="giq-home-features-section relative mx-auto max-w-7xl px-6 py-16"
        data-onboarding-target="public-home-features"
      >
        <div className="giq-home-feature-grid grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      <Suspense fallback={<PricingCtaFallback />}>
        <PricingCtaSection />
      </Suspense>

      <Suspense fallback={<TodaysRacesFallback />}>
        <TodaysRacesSection />
      </Suspense>
    </div>
  );
}

async function TodaysRacesSection() {
  const meetings = await getTodaysMeetings();
  const totalRaces = meetings.reduce((acc, m) => acc + m.races.length, 0);

  return (
    <section
      id="races"
      className="giq-home-races-section relative mx-auto max-w-7xl px-6 py-8"
      data-onboarding-target="public-home-races"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
            Today&apos;s Races
          </h2>
          <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
            {formatLongRaceDayLabel(new Date())}
          </p>
        </div>
        {meetings.length > 0 && (
          <span className="text-[12px] text-[hsl(var(--subtle-foreground))] tracking-[-0.013em]">
            {meetings.length} meetings · {totalRaces} races
          </span>
        )}
      </div>

      {meetings.length === 0 ? (
        <div className="giq-empty-state p-16 text-center">
          <p className="text-[hsl(var(--muted-foreground))] text-[15px] tracking-[-0.013em]">
            No meetings are available for this race day yet. Try the race
            explorer for recent archived cards.
          </p>
          <Link
            href="/races"
            className="giq-outline-action mx-auto mt-4 min-h-11 w-fit px-4 text-[13px] font-semibold"
          >
            Open race explorer
          </Link>
        </div>
      ) : (
        <div className="giq-stagger grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}
    </section>
  );
}

function TodaysRacesFallback() {
  return (
    <section
      id="races"
      className="giq-home-races-section relative mx-auto max-w-7xl px-6 py-8"
      data-onboarding-target="public-home-races"
    >
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
          Today&apos;s Races
        </h2>
        <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
          Loading race cards.
        </p>
      </div>
      <SkeletonGroup label="Loading today's races">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <SkeletonPanel key={item} className="p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((slot) => (
                  <Skeleton key={slot} className="h-10" />
                ))}
              </div>
            </SkeletonPanel>
          ))}
        </div>
      </SkeletonGroup>
    </section>
  );
}

async function PricingCtaSection() {
  const { plans } = await getPricingContent();
  const homePlans = plans.filter(({ id }) => id !== "pro_plus");

  return (
    <section
      id="pricing"
      className="relative mx-auto max-w-6xl px-6 py-14 md:py-16"
      data-onboarding-target="public-home-pricing"
    >
      <div className="mb-8 text-center">
        <span className="giq-pill giq-pill-gold mb-3 inline-flex">
          Start free · upgrade when it earns its place
        </span>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
          Clear value. <span className="gradient-text">Simple pricing.</span>
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-[14px] text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
          Follow every Australian race for free. Go Pro when you need advanced
          racing intelligence, breeding tools, messaging, and Marketplace
          selling — all priced in AUD.
        </p>
      </div>

      <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
        {homePlans.map((plan) => (
          <div
            key={plan.name}
            className={`giq-pricing-card flex flex-col ${plan.highlighted ? "giq-pricing-card-featured lg:scale-[1.02]" : ""}`}
          >
            {plan.highlighted && (
              <div className="giq-badge giq-badge-purple giq-plan-popular">
                MOST POPULAR
              </div>
            )}
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[16px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
                {plan.name}
              </span>
            </div>
            <div className="mb-1">
              <span className="giq-plan-price">{plan.price}</span>
              <span className="ml-1 text-[13px] text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
                {plan.period}
              </span>
            </div>
            <p className="mb-5 mt-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
              {plan.description}
            </p>
            <Link
              href={
                plan.id === "free" ? "/sign-in?plan=free" : "/pricing#plans"
              }
              className={`giq-button mb-5 w-full text-center text-[13px] font-semibold ${plan.highlighted ? "giq-button-primary" : "giq-button-carbon"}`}
            >
              {plan.id === "free" ? "Start Free" : plan.cta || "View plan"}
            </Link>
            <ul className="space-y-2">
              {plan.features.slice(0, 5).map((f) => (
                <li key={f} className="giq-plan-feature">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[hsl(var(--primary-bright))]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/sign-in?plan=free"
          className="giq-button giq-button-primary min-h-11 px-6 text-[13px] font-semibold"
        >
          Create your free account
        </Link>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[hsl(var(--primary-bright))] hover:underline"
        >
          Compare all plans &amp; features{" "}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function PricingCtaFallback() {
  return (
    <section
      className="relative mx-auto max-w-6xl px-6 py-14 md:py-16"
      data-onboarding-target="public-home-pricing"
    >
      <div className="mb-8 text-center">
        <Skeleton className="mx-auto h-8 w-64" />
        <Skeleton className="mx-auto mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <SkeletonPanel key={i} className="h-80" />
        ))}
      </div>
    </section>
  );
}

function FeatureCard({
  image,
  title,
  description,
  href,
  link,
  tone,
}: {
  image: string;
  title: string;
  description: string;
  href: string;
  link: string;
  tone: "primary" | "info" | "secondary" | "success";
}) {
  return (
    <Link
      href={href}
      className={`giq-glass-panel giq-feature-card giq-feature-card--${tone} group block overflow-hidden no-underline`}
    >
      <div className="giq-feature-media giq-shine giq-shine-hover">
        <Image
          src={siteAssetUrl(image)}
          alt={title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
        />
      </div>
      <div className="p-5">
        <h2 className="text-[15px] font-semibold text-[hsl(var(--foreground))] mb-1.5 tracking-[-0.015em]">
          {title}
        </h2>
        <p className="min-h-[68px] text-[13px] text-[hsl(var(--muted-foreground))] leading-relaxed tracking-[-0.013em]">
          {description}
        </p>
        <span className="giq-feature-link mt-4">
          {link}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
