import { getTodaysMeetings } from "@/lib/queries";
import { MeetingCard } from "@/components/meeting-card";
import { PageHero } from "@/components/page-hero";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  CircleMinus,
  Code2,
  DatabaseZap,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { siteAssetUrl } from "@/lib/storage-paths";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    image: "/images/feature-career-form-purple.webp",
    title: "Full Career Form",
    description:
      "Every start, every time, every track. Complete career history with sectionals and split times.",
    href: "/dogs",
    link: "Explore Form",
    tone: "primary",
  },
  {
    image: "/images/feature-ai-predictions-blue.webp",
    title: "AI Predictions",
    description:
      "Machine learning race predictions with probability modelling and confidence intervals.",
    href: "/agents",
    link: "View Predictions",
    tone: "info",
  },
  {
    image: "/images/feature-breeding-analytics-gold.webp",
    title: "Breeding Analytics",
    description:
      "5-generation pedigrees, testmating tools, sire strike rates, and litter performance.",
    href: "/breeding",
    link: "Analyse Breeding",
    tone: "secondary",
  },
  {
    image: "/images/feature-advanced-stats-green.webp",
    title: "Advanced Stats",
    description:
      "Track bias, box statistics, trainer leaderboards, speed maps, and custom dashboards.",
    href: "/statistics",
    link: "View Stats",
    tone: "success",
  },
] as const;

const COMPARISON = [
  {
    feature: "Data source",
    them: "User-contributed",
    us: "Official feeds",
    Icon: DatabaseZap,
  },
  {
    feature: "Currency",
    them: "GBP (£)",
    us: "AUD ($)",
    Icon: BadgeDollarSign,
  },
  {
    feature: "Pro price/year",
    them: "~$125 AUD",
    us: "$99 AUD",
    Icon: BadgeDollarSign,
    emphasis: true,
  },
  {
    feature: "AI predictions",
    them: "Not available",
    us: "ML-powered",
    Icon: Sparkles,
    emphasis: true,
  },
  {
    feature: "Mobile-first",
    them: "Not available",
    us: "Built mobile-first",
    Icon: Smartphone,
  },
  {
    feature: "Ad-free",
    them: "Ad-heavy",
    us: "Zero ads",
    Icon: ShieldCheck,
  },
  {
    feature: "API access",
    them: "Not available",
    us: "Pro+ tier",
    Icon: Code2,
  },
] as const;

export default function HomePage() {
  return (
    <div className="giq-home-page fade-in">
      <HomeHero />

      <section className="giq-home-features-section relative mx-auto max-w-7xl px-6 py-16">
        <div className="giq-home-feature-grid grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      <Suspense fallback={<TodaysRacesFallback />}>
        <TodaysRacesSection />
      </Suspense>

      <WhyGreyhoundIQSection />
    </div>
  );
}

function HomeHero() {
  return (
    <PageHero
      image="/images/wentworth-gate-hero.webp"
      size="tall"
      title={
        <>
          Australian greyhound racing,
          <br />
          <span className="giq-text-gold-glass">done</span>{" "}
          <span className="giq-text-purple-glass">right.</span>
        </>
      }
      subtitle="Real-time race cards, full career form, breeding analytics, AI predictions, and a community for breeders and owners — all in one place. No ads. No clutter. No GBP pricing."
    >
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="#races"
          className="giq-liquid-purple-button group text-[14px] font-semibold tracking-[-0.013em]"
        >
          View Today&apos;s Races
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <Link
          href="/pricing"
          className="giq-button giq-button-carbon px-6 text-[14px] font-semibold"
        >
          See Pricing
        </Link>
      </div>
    </PageHero>
  );
}

async function TodaysRacesSection() {
  const meetings = await getTodaysMeetings();
  const totalRaces = meetings.reduce((acc, m) => acc + m.races.length, 0);

  return (
    <section id="races" className="giq-home-races-section relative mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
            Today&apos;s Races
          </h2>
          <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
            {new Date().toLocaleDateString("en-AU", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
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
            No meetings in the database yet. The data pipeline connects in Phase 2.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
    <section id="races" className="giq-home-races-section relative mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
          Today&apos;s Races
        </h2>
        <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
          Loading race cards.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-40 animate-pulse rounded-xl border border-white/[0.04] bg-white/[0.02]"
          />
        ))}
      </div>
    </section>
  );
}

function WhyGreyhoundIQSection() {
  return (
    <section className="giq-home-why-section giq-comparison-section relative mx-auto max-w-7xl px-6 py-12 md:py-14">
      <div className="giq-comparison-heading">
        <div>
          <h2>
            Why <span className="giq-text-purple-glass">Greyhound</span><span className="giq-text-gold-glass">IQ?</span>
          </h2>
          <p>
            Built for serious local racing users with official feeds, AUD pricing, AI predictions, mobile-first workflows, and zero ads.
          </p>
        </div>
        <div className="giq-comparison-meta" aria-label="GreyhoundIQ advantages">
          <span className="giq-pill giq-pill-purple">AI powered</span>
          <span className="giq-pill giq-pill-gold">$99 AUD</span>
          <span className="giq-pill giq-pill-muted">Zero ads</span>
        </div>
      </div>

      <div className="giq-comparison-board">
        <div className="giq-comparison-board-glow" aria-hidden="true" />

        <div className="giq-comparison-column-header">
          <span>Feature</span>
          <span>greyhound-data.com</span>
          <span>GreyhoundIQ</span>
        </div>

        <div className="giq-comparison-row-list">
          {COMPARISON.map((item) => {
            const isUnavailable = item.them === "Not available";
            const isLimited = isUnavailable || item.them === "Ad-heavy";
            const isEmphasis = "emphasis" in item && item.emphasis;
            const Icon = item.Icon;

            return (
              <article
                key={item.feature}
                className={`giq-comparison-row${isEmphasis ? " is-emphasis" : ""}`}
              >
                <div className="giq-comparison-feature">
                  <span className="giq-comparison-feature-icon">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span>{item.feature}</span>
                </div>

                <div className={`giq-comparison-cell giq-comparison-cell--competitor${isLimited ? " is-limited" : ""}`}>
                  <span className="giq-comparison-mobile-label">greyhound-data.com</span>
                  <span className="giq-comparison-value">
                    {isLimited ? (
                      <CircleMinus aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <span className="giq-comparison-neutral-dot" aria-hidden="true" />
                    )}
                    {item.them}
                  </span>
                </div>

                <div className={`giq-comparison-cell giq-comparison-cell--giq${isEmphasis ? " is-highlight" : ""}`}>
                  <span className="giq-comparison-mobile-label">GreyhoundIQ</span>
                  <span className="giq-comparison-value">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    {item.us}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
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
    <article className={`giq-glass-panel giq-feature-card giq-feature-card--${tone} group overflow-hidden`}>
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
        <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))] mb-1.5 tracking-[-0.015em]">
          {title}
        </h3>
        <p className="min-h-[68px] text-[13px] text-[hsl(var(--muted-foreground))] leading-relaxed tracking-[-0.013em]">
          {description}
        </p>
        <Link href={href} className="giq-feature-link mt-4">
          {link}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}
