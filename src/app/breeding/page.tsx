import { Dna, Sparkles, GitBranch, Layers, TrendingUp, Calendar } from "lucide-react";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";

export const metadata = { title: "Breeding — GreyhoundIQ" };

const FEATURES = [
  { icon: Dna, title: "5-Generation Pedigrees", desc: "Visual pedigree trees with performance data at every node. Winners, stakes earners, and track records throughout the bloodline.", phase: "Phase 2" },
  { icon: Sparkles, title: "Testmating Tool", desc: "Cross any sire with any dam to predict offspring traits. Uses historical nicking patterns and performance genetics.", phase: "Phase 2" },
  { icon: GitBranch, title: "Sire Statistics", desc: "Strike rates, progeny earnings, track performance breakdowns, and age-specific performance for every active sire.", phase: "Phase 2" },
  { icon: Layers, title: "Litter Performance", desc: "Track every litter by sire × dam combination. Identify overperforming and underperforming crosses.", phase: "Phase 2" },
];

const SIRE_LEADERS = [
  { name: "Barcia Bale", progeny: 184, winners: 102, strike: 55.4, earnings: "$2.4M" },
  { name: "Fernando Bale", progeny: 156, winners: 89, strike: 57.1, earnings: "$2.1M" },
  { name: "Kinloch Brae", progeny: 142, winners: 76, strike: 53.5, earnings: "$1.8M" },
  { name: "Premier Fantasy", progeny: 128, winners: 71, strike: 55.5, earnings: "$1.6M" },
  { name: "Superior Panama", progeny: 119, winners: 64, strike: 53.8, earnings: "$1.4M" },
];

export default function BreedingPage() {
  return (
    <div className="fade-in">
      <PageHero
        image="/images/feature-breeding-analytics.png"
        badge="BREEDING ANALYTICS"
        badgeIcon={<Dna className="h-3 w-3 text-[hsl(142_60%_48%)]" />}
        badgeColor="green"
        title={
          <>
            Bloodlines,
            <br />
            <span className="gradient-text">decoded.</span>
          </>
        }
        subtitle="5-generation pedigrees, testmating, sire statistics, and litter performance — the data tools Australian breeders have been waiting for."
      >
        <div className="mt-8 flex gap-3">
          <Link
            href="/dogs"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(142_76%_36%)] to-[hsl(142_60%_40%)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-xl shadow-[hsl(142_76%_36%/0.25)] hover:brightness-110 transition-all tracking-[-0.013em]"
          >
            Search Dogs
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-[13px] font-medium text-[hsl(210_13%_97%)] hover:bg-white/[0.06] backdrop-blur-sm transition-all"
          >
            See Pricing
          </Link>
        </div>
      </PageHero>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)] mb-2 tracking-[-0.03em]">
          What ships in Phase 2
        </h2>
        <p className="text-[14px] text-[hsl(215_14%_65%)] mb-8 tracking-[-0.013em]">
          Full breeding toolkit, launching after the MVP.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(142_76%_36%/0.1)]">
                    <Icon className="h-5 w-5 text-[hsl(142_60%_48%)]" />
                  </div>
                  <span className="rounded-full bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-[hsl(215_14%_65%)] tracking-[0.04em]">
                    {f.phase}
                  </span>
                </div>
                <h3 className="text-[16px] font-semibold text-[hsl(210_13%_97%)] mb-2 tracking-[-0.02em]">
                  {f.title}
                </h3>
                <p className="text-[13px] text-[hsl(215_14%_65%)] leading-relaxed tracking-[-0.013em]">
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)] mb-1 tracking-[-0.03em]">
              Top Active Sires
            </h2>
            <p className="text-[13px] text-[hsl(215_14%_65%)] tracking-[-0.013em]">
              Sample data — full leaderboard with Phase 2
            </p>
          </div>
          <TrendingUp className="h-5 w-5 text-[hsl(142_60%_48%)]" />
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-[hsl(220_7%_42%)]">
                <th className="text-left p-4 tracking-[0.04em]">Sire</th>
                <th className="text-right p-4 tracking-[0.04em]">Progeny</th>
                <th className="text-right p-4 tracking-[0.04em]">Winners</th>
                <th className="text-right p-4 tracking-[0.04em]">Strike %</th>
                <th className="text-right p-4 tracking-[0.04em]">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {SIRE_LEADERS.map((s, i) => (
                <tr
                  key={s.name}
                  className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
                        style={{
                          background: i === 0 ? "hsl(142 76% 36% / 0.2)" : "hsl(220 7% 16%)",
                          color: i === 0 ? "hsl(142 60% 48%)" : "hsl(215 14% 65%)",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-[14px] font-medium text-[hsl(210_13%_97%)] tracking-[-0.013em]">
                        {s.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right text-[13px] text-[hsl(215_14%_65%)] font-mono">{s.progeny}</td>
                  <td className="p-4 text-right text-[13px] text-[hsl(215_14%_65%)] font-mono">{s.winners}</td>
                  <td className="p-4 text-right text-[13px] font-mono font-semibold text-[hsl(142_60%_48%)]">{s.strike}%</td>
                  <td className="p-4 text-right text-[13px] text-[hsl(210_13%_97%)] font-mono">{s.earnings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <Calendar className="h-5 w-5 text-[hsl(25_95%_53%)] mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-[hsl(210_13%_97%)] mb-2 tracking-[-0.02em]">
          Shipping in 6-8 weeks
        </h2>
        <p className="text-[14px] text-[hsl(215_14%_65%)] leading-relaxed max-w-xl mx-auto tracking-[-0.013em]">
          MVP race cards and dog search ship in 2 weeks. Full breeding toolkit
          follows in Phase 2 (weeks 4-6). Free tier gets basic form; Pro unlocks
          full pedigrees, testmating, and sire statistics.
        </p>
      </section>
    </div>
  );
}
