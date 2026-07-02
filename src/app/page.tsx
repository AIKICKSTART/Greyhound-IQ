import { getTodaysMeetings } from "@/lib/queries";
import { MeetingCard } from "@/components/meeting-card";
import { PageHero } from "@/components/page-hero";
import {
  Activity,
  ArrowRight,
  BarChart3,
  ShieldCheck,
  Target,
  Users,
  type LucideIcon,
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

const STATS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "25K+", label: "Active Members", icon: Users },
  { value: "2.4M+", label: "Races Analysed", icon: BarChart3 },
  { value: "89%", label: "Prediction Accuracy", icon: Target },
  { value: "100%", label: "Ad Free Experience", icon: ShieldCheck },
];

const COMPARISON = [
  ["Data source", "User-contributed", "Official feeds"],
  ["Currency", "GBP (£)", "AUD ($)"],
  ["Pro price/year", "~$125 AUD", "$99 AUD"],
  ["AI predictions", "—", "ML-powered"],
  ["Mobile-first", "—", "Built mobile-first"],
  ["Ad-free", "Ad-heavy", "Zero ads"],
  ["API access", "—", "Pro+ tier"],
];

export default function HomePage() {
  return (
    <div className="fade-in">
      <HomeHero />

      <section className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      badge="REAL-TIME. AI-POWERED. BUILT FOR WINNERS."
      badgeIcon={<Activity className="h-3.5 w-3.5 text-[hsl(var(--secondary-light))]" />}
      badgeColor="gold"
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
      <div className="giq-home-stat-grid mt-9">
        {STATS.map((stat) => {
          const Icon = stat.icon;

          return (
            <div key={stat.label} className="giq-home-stat">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[hsl(var(--secondary-light))]" />
                <span className="giq-home-stat-value">{stat.value}</span>
              </div>
              <span className="giq-home-stat-label">{stat.label}</span>
            </div>
          );
        })}
      </div>
    </PageHero>
  );
}

async function TodaysRacesSection() {
  const meetings = await getTodaysMeetings();
  const totalRaces = meetings.reduce((acc, m) => acc + m.races.length, 0);

  return (
    <section id="races" className="relative mx-auto max-w-7xl px-6 py-8">
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
    <section id="races" className="relative mx-auto max-w-7xl px-6 py-8">
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
    <section className="relative mx-auto max-w-4xl px-6 py-20">
      <h2 className="text-center text-2xl font-semibold text-[hsl(var(--foreground))] mb-8 tracking-[-0.03em]">
        Why GreyhoundIQ?
      </h2>
      <div className="giq-glass-panel overflow-hidden rounded-xl">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="text-left p-4 font-medium text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
                Feature
              </th>
              <th className="text-center p-4 font-medium text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
                greyhound-data.com
              </th>
              <th className="text-center p-4 font-medium text-[hsl(var(--primary-bright))] tracking-[-0.013em]">
                GreyhoundIQ
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map(([feature, them, us]) => (
              <tr key={feature} className="border-b border-white/[0.04] last:border-0">
                <td className="p-4 text-[hsl(var(--foreground))] tracking-[-0.013em]">{feature}</td>
                <td className="p-4 text-center text-[hsl(var(--subtle-foreground))] tracking-[-0.013em]">{them}</td>
                <td className="p-4 text-center text-[hsl(var(--primary-bright))] tracking-[-0.013em]">{us}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
