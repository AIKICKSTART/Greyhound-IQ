import { Dna, Sparkles, GitBranch, Layers, TrendingUp, Calendar } from "lucide-react";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { getSireLeaderboard } from "@/lib/queries";
import { ProGate } from "@/components/pro-gate";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Breeding Analytics — GreyhoundIQ",
  description: "5-generation pedigrees, testmating, sire statistics, and litter performance for Australian greyhound breeders.",
};

const FEATURES = [
  { icon: Dna, title: "5-Generation Pedigrees", desc: "Visual pedigree trees with performance data at every node. Winners, stakes earners, and track records throughout the bloodline.", phase: "Phase 2" },
  { icon: Sparkles, title: "Testmating Tool", desc: "Cross any sire with any dam to predict offspring traits. Uses historical nicking patterns and performance genetics.", phase: "Phase 2" },
  { icon: GitBranch, title: "Sire Statistics", desc: "Strike rates, progeny earnings, track performance breakdowns, and age-specific performance for every active sire.", phase: "Phase 2" },
  { icon: Layers, title: "Litter Performance", desc: "Track every litter by sire × dam combination. Identify overperforming and underperforming crosses.", phase: "Phase 2" },
];

function formatEarnings(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default async function BreedingPage() {
  const SIRE_LEADERS = (await getSireLeaderboard(8)).map((s) => ({
    ...s,
    earnings: formatEarnings(s.earnings),
  }));

  return (
    <div className="fade-in">
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        badge="BREEDING ANALYTICS"
        badgeIcon={<Dna className="h-3 w-3 text-[hsl(var(--primary-bright))]" />}
        badgeColor="primary"
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
            className="giq-liquid-purple-button px-5 text-[13px] font-semibold"
          >
            Search Dogs
          </Link>
          <Link
            href="/pricing"
            className="giq-button giq-button-glass px-5 text-[13px] font-medium"
          >
            See Pricing
          </Link>
        </div>
      </PageHero>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))] mb-2 tracking-[-0.03em]">
          What ships in Phase 2
        </h2>
        <p className="text-[14px] text-[hsl(var(--muted-foreground))] mb-8 tracking-[-0.013em]">
          Full breeding toolkit, launching after the MVP.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="giq-panel giq-panel-hover group p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="giq-icon-plate flex h-10 w-10 items-center justify-center rounded-lg">
                    <Icon className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
                  </div>
                  <span className="giq-badge giq-badge-neutral">
                    {f.phase}
                  </span>
                </div>
                <h3 className="text-[16px] font-semibold text-[hsl(var(--foreground))] mb-2 tracking-[-0.02em]">
                  {f.title}
                </h3>
                <p className="text-[13px] text-[hsl(var(--muted-foreground))] leading-relaxed tracking-[-0.013em]">
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 pb-16">
        <ProGate minTier="pro" feature="Breeding analytics">
      <section className="px-0">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))] mb-1 tracking-[-0.03em]">
              Top Active Sires
            </h2>
            <p className="text-[13px] text-[hsl(var(--muted-foreground))] tracking-[-0.013em]">
              Live from current data — ranked by progeny winners
            </p>
          </div>
          <TrendingUp className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
        </div>

        <div className="giq-table-shell">
          <table className="w-full">
            <thead>
              <tr className="giq-table-head">
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
                  className="giq-table-row"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
                        style={{
                          background: i === 0 ? "hsl(var(--primary) / 0.20)" : "hsl(var(--surface-3))",
                          color: i === 0 ? "hsl(var(--primary-bright))" : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-[14px] font-medium text-[hsl(var(--foreground))] tracking-[-0.013em]">
                        {s.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right text-[13px] text-[hsl(var(--muted-foreground))] font-mono">{s.progeny}</td>
                  <td className="p-4 text-right text-[13px] text-[hsl(var(--muted-foreground))] font-mono">{s.winners}</td>
                  <td className="p-4 text-right text-[13px] font-mono font-semibold text-[hsl(var(--primary-bright))]">{s.strike}%</td>
                  <td className="p-4 text-right text-[13px] text-[hsl(var(--foreground))] font-mono">{s.earnings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
        </ProGate>
      </div>

      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <Calendar className="h-5 w-5 text-[hsl(var(--secondary))] mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-2 tracking-[-0.02em]">
          Shipping in 6-8 weeks
        </h2>
        <p className="text-[14px] text-[hsl(var(--muted-foreground))] leading-relaxed max-w-xl mx-auto tracking-[-0.013em]">
          MVP race cards and dog search ship in 2 weeks. Full breeding toolkit
          follows in Phase 2 (weeks 4-6). Free tier gets basic form; Pro unlocks
          full pedigrees, testmating, and sire statistics.
        </p>
      </section>
    </div>
  );
}
