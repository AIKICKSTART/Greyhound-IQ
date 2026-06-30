import { getTodaysMeetings } from "@/lib/queries";
import { MeetingCard } from "@/components/meeting-card";
import { PageHero } from "@/components/page-hero";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

const FEATURES = [
  { image: "/images/feature-pricing-product.png", title: "Full Career Form", description: "Every start, every time, every track. Complete career history with sectionals and split times." },
  { image: "/images/feature-ai-predictions.png", title: "AI Predictions", description: "Machine learning race predictions with probability modelling and confidence intervals." },
  { image: "/images/feature-breeding-analytics.png", title: "Breeding Analytics", description: "5-generation pedigrees, testmating tools, sire strike rates, and litter performance." },
  { image: "/images/feature-advanced-stats.png", title: "Advanced Stats", description: "Track bias, box statistics, trainer leaderboards, speed maps, and custom dashboards." },
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

export default async function HomePage() {
  const meetings = await getTodaysMeetings();
  const totalRaces = meetings.reduce((acc, m) => acc + m.races.length, 0);

  return (
    <div className="fade-in">
      <PageHero
        image="/images/hero-greyhoundiq-brand.png"
        size="tall"
        title={
          <>
            Australian greyhound racing,
            <br />
            <span className="gradient-text">done right.</span>
          </>
        }
        subtitle="Real-time race cards, full career form, breeding analytics, AI predictions, and a community for breeders and owners — all in one place. No ads. No clutter. No GBP pricing."
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="#races"
            className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(142_76%_36%)] to-[hsl(142_60%_40%)] px-6 py-3 text-[14px] font-semibold text-white shadow-xl shadow-[hsl(142_76%_36%/0.25)] hover:shadow-[hsl(142_76%_36%/0.4)] hover:brightness-110 transition-all tracking-[-0.013em]"
          >
            View Today&apos;s Races
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-6 py-3 text-[14px] font-medium text-[hsl(210_13%_97%)] hover:bg-white/[0.06] backdrop-blur-sm transition-all tracking-[-0.013em]"
          >
            See Pricing
          </Link>
        </div>
      </PageHero>

      <section className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      <section id="races" className="relative mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em] text-[hsl(210_13%_97%)]">
              Today&apos;s Races
            </h2>
            <p className="mt-1 text-[14px] text-[hsl(215_14%_65%)] tracking-[-0.013em]">
              {new Date().toLocaleDateString("en-AU", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          {meetings.length > 0 && (
            <span className="text-[12px] text-[hsl(220_7%_42%)] tracking-[-0.013em]">
              {meetings.length} meetings · {totalRaces} races
            </span>
          )}
        </div>

        {meetings.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-16 text-center">
            <p className="text-[hsl(215_14%_65%)] text-[15px] tracking-[-0.013em]">
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

      <section className="relative mx-auto max-w-4xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold text-[hsl(210_13%_97%)] mb-8 tracking-[-0.03em]">
          Why GreyhoundIQ?
        </h2>
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left p-4 font-medium text-[hsl(215_14%_65%)] tracking-[-0.013em]">
                  Feature
                </th>
                <th className="text-center p-4 font-medium text-[hsl(215_14%_65%)] tracking-[-0.013em]">
                  greyhound-data.com
                </th>
                <th className="text-center p-4 font-medium text-[hsl(142_60%_48%)] tracking-[-0.013em]">
                  GreyhoundIQ
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(([feature, them, us]) => (
                <tr key={feature} className="border-b border-white/[0.04] last:border-0">
                  <td className="p-4 text-[hsl(210_13%_97%)] tracking-[-0.013em]">{feature}</td>
                  <td className="p-4 text-center text-[hsl(220_7%_42%)] tracking-[-0.013em]">{them}</td>
                  <td className="p-4 text-center text-[hsl(142_60%_48%)] tracking-[-0.013em]">{us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  image,
  title,
  description,
}: {
  image: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:border-white/[0.12] transition-all">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(150_30%_3%)] via-transparent to-transparent" />
      </div>
      <div className="p-5">
        <h3 className="text-[15px] font-semibold text-[hsl(210_13%_97%)] mb-1.5 tracking-[-0.015em]">
          {title}
        </h3>
        <p className="text-[13px] text-[hsl(215_14%_65%)] leading-relaxed tracking-[-0.013em]">
          {description}
        </p>
      </div>
    </div>
  );
}
