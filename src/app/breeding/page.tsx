import {
  Dna,
  TrendingUp,
  TrendingDown,
  Minus,
  GitBranch,
  BookOpen,
  GitCompareArrows,
  Layers,
  ArrowRight,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHero } from "@/components/page-hero";
import { PedigreeExplorer } from "@/components/pedigree-explorer";
import { RacingDataDisclosure } from "@/components/racing-data-disclosure";
import { RacingDataEmptyState } from "@/components/racing-data-empty-state";
import { nickVerdict } from "@/lib/nicking";
import {
  getBreedingStats,
  getLitters,
  getSireLeaderboard,
  type LitterCross,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Breeding Intelligence — GreyhoundIQ",
  description:
    "Explore Australian greyhound pedigrees — race dogs and breeding sires and dams linked across generations, with live sire statistics from the studbook and racing record.",
};

function formatEarnings(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatCount(n: number): string {
  return n.toLocaleString("en-AU");
}

export default async function BreedingPage() {
  const [stats, sireLeaders, litters] = await Promise.all([
    getBreedingStats(),
    getSireLeaderboard(10),
    getLitters(undefined, 12),
  ]);
  const sires = sireLeaders.map((s) => ({ ...s, earnings: formatEarnings(s.earnings) }));
  const topSires = sires.slice(0, 3);

  const statCards = [
    { label: "Greyhounds mapped", value: formatCount(stats.totalDogs), icon: Dna },
    { label: "Breeding dogs", value: formatCount(stats.breedingDogs), icon: GitBranch },
    { label: "With pedigree links", value: formatCount(stats.pedigreedDogs), icon: TrendingUp },
    { label: "Studbook volumes", value: String(stats.studbookVolumes), icon: BookOpen },
  ];

  return (
    <div>
      <PageHero
        image="/images/feature-breeding-analytics-gold.webp"
        badge="BREEDING INTELLIGENCE"
        badgeIcon={<Dna className="h-3 w-3 text-[hsl(var(--primary-bright))]" />}
        badgeColor="primary"
        title={
          <>
            Every bloodline,
            <br />
            <span className="gradient-text">connected.</span>
          </>
        }
        subtitle="Search any greyhound and trace its pedigree across generations — race dogs and the breeding sires and dams behind them, linked from the official studbook and the racing record."
      >
        <div className="giq-stagger mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="giq-metric-card relative overflow-hidden p-4">
                <Icon className="mb-2 h-4 w-4 text-[hsl(var(--primary-bright))]" />
                <p className="text-[20px] font-semibold tabular-nums tracking-[-0.02em] text-[hsl(var(--foreground))]">
                  {s.value}
                </p>
                <p className="mt-0.5 text-[11px] tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
                  {s.label}
                </p>
                <span
                  aria-hidden="true"
                  className="mt-3 block h-[3px] w-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary-bright)/0.75),hsl(var(--secondary)/0.55)_68%,transparent)]"
                />
              </div>
            );
          })}
        </div>
      </PageHero>

      <div className="mx-auto max-w-6xl px-6 pt-8">
        <RacingDataDisclosure />
      </div>

      {/* Flagship — Test mating is the paid, marquee tool; give it a band of its own. */}
      <section aria-labelledby="flagship-heading" className="mx-auto max-w-6xl px-6 pt-10 sm:pt-12">
        <div className="giq-panel giq-page-enter relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,hsl(var(--secondary)/0.16),transparent_70%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 bottom-[-6rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.14),transparent_70%)]"
          />
          <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:p-10">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="giq-icon-plate flex h-9 w-9 items-center justify-center rounded-lg">
                  <GitCompareArrows className="h-4 w-4" />
                </span>
                <span className="giq-eyebrow text-[hsl(var(--secondary-light))]">
                  Flagship · Sire × Dam
                </span>
                <span className="giq-badge giq-badge-gold px-2 py-0.5 text-[10px]">Pro</span>
              </div>
              <h2
                id="flagship-heading"
                className="mt-4 text-[26px] font-semibold leading-[1.06] tracking-[-0.03em] text-[hsl(var(--foreground))] sm:text-[32px]"
              >
                Test any mating before it happens
              </h2>
              <p className="mt-3.5 max-w-prose text-[14px] leading-relaxed tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
                Pair any sire with any dam to reveal the shared ancestors the cross would carry,
                the line-breeding overlap it creates, and each parent&rsquo;s real progeny record —
                bridged straight from the studbook and the racing record.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
                <Link
                  href="/breeding/cross"
                  className="group giq-button giq-button-gold text-[13px] font-semibold"
                >
                  Open test mating
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
                <span className="inline-flex items-center gap-1.5 text-[12px] tracking-[-0.01em] text-[hsl(var(--subtle-foreground))]">
                  <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--secondary-light))]" />
                  Included with Pro · $20/month
                </span>
              </div>
            </div>

            {/* Sire × Dam preview: gold sire node meets purple dam node. */}
            <div className="giq-subpanel relative overflow-hidden p-6">
              <div className="flex items-center justify-center gap-1">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-[hsl(var(--secondary-light)/0.35)] bg-[hsl(var(--secondary)/0.14)] shadow-[0_0_28px_-14px_hsl(var(--secondary-light))]">
                  <TrendingUp className="h-6 w-6 text-[hsl(var(--secondary-light))]" />
                </span>
                <span className="z-10 -mx-3 flex h-8 w-8 items-center justify-center rounded-full border border-[hsl(var(--metal-silver)/0.25)] bg-[hsl(var(--surface-3))] text-[13px] font-semibold text-[hsl(var(--muted-foreground))]">
                  ×
                </span>
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-[hsl(var(--primary-light)/0.35)] bg-[hsl(var(--primary)/0.16)] shadow-[0_0_28px_-14px_hsl(var(--primary-bright))]">
                  <Dna className="h-6 w-6 text-[hsl(var(--primary-bright))]" />
                </span>
              </div>
              <div className="mt-4 flex items-center justify-center gap-8 text-center">
                <span className="giq-eyebrow text-[hsl(var(--secondary-light))]">Sire</span>
                <span className="giq-eyebrow text-[hsl(var(--primary-light))]">Dam</span>
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <TileChip>Shared ancestors</TileChip>
                <TileChip>Line-breeding overlap</TileChip>
                <TileChip>Progeny record</TileChip>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The rest of the suite — free tools, arranged with the pedigree explorer as anchor. */}
      <section className="mx-auto max-w-6xl px-6 pt-14">
        <div className="mb-6">
          <p className="giq-eyebrow mb-2 text-[hsl(var(--subtle-foreground))]">
            Also included · free
          </p>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
            The breeding intelligence suite
          </h2>
        </div>

        <div className="giq-stagger grid gap-3 sm:grid-cols-2 lg:auto-rows-fr lg:grid-cols-3">
          <FeatureTile
            href="#pedigree"
            icon={Dna}
            eyebrow="Family tree"
            title="Pedigree explorer"
            desc="Search any greyhound and trace five generations of ancestry — every sire and dam links to its own profile, with inbreeding and line-breeding flagged automatically."
            cta="Explore pedigrees"
            className="sm:col-span-2 lg:col-span-2 lg:row-span-2"
          >
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <p className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[hsl(var(--foreground))]">
                  {formatCount(stats.pedigreedDogs)}
                </p>
                <p className="giq-eyebrow mt-1.5 text-[hsl(var(--subtle-foreground))]">
                  pedigrees linked
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <TileChip>5 generations</TileChip>
                <TileChip>Inbreeding detection</TileChip>
                <TileChip>Line-breeding</TileChip>
                <TileChip>{formatCount(stats.totalDogs)} dogs mapped</TileChip>
              </div>
            </div>
          </FeatureTile>

          <FeatureTile
            href="#sires"
            icon={TrendingUp}
            eyebrow="Progeny record"
            title="Sire statistics"
            desc="Every sire's real progeny record — winners, strike rate and prize money, ranked across the racing record."
            cta="View sire rankings"
            className="lg:col-span-1"
          >
            {topSires.length > 0 ? (
              <ul className="space-y-2">
                {topSires.map((s, i) => (
                  <li key={s.sireId} className="flex items-center gap-2.5 text-[12px]">
                    <RankChip rank={i + 1} />
                    <span className="min-w-0 flex-1 truncate font-medium tracking-[-0.01em] text-[hsl(var(--foreground))]">
                      {s.name}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-[hsl(var(--primary-bright))]">
                      {s.earnings}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <TileChip>Rankings not yet available</TileChip>
            )}
          </FeatureTile>

          <FeatureTile
            href="#litters"
            icon={Layers}
            eyebrow="Nicking"
            title="Litter performance"
            desc="Sire × dam crosses ranked by winners, each rated against both parents' baseline — does the cross nick?"
            cta="Rank the crosses"
            className="lg:col-span-1"
          >
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <p className="text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[hsl(var(--foreground))]">
                  {litters.length}
                  {litters.length >= 12 ? "+" : ""}
                </p>
                <p className="giq-eyebrow mt-1.5 text-[hsl(var(--subtle-foreground))]">
                  crosses ranked
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <TileChip>Nicking verdict</TileChip>
                <TileChip>$ / progeny</TileChip>
              </div>
            </div>
          </FeatureTile>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div id="pedigree" className="mb-4 scroll-mt-24">
          <h2 className="mb-1 text-2xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
            Pedigree explorer
          </h2>
          <p className="text-[14px] tracking-[-0.013em] text-[hsl(var(--muted-foreground))]">
            Search a greyhound to open its family tree. Every ancestor links through to its own profile.
          </p>
        </div>
        <PedigreeExplorer />
      </section>

      <div id="sires" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="mb-1 text-2xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
              Top active sires
            </h2>
            <p className="text-[13px] tracking-[-0.013em] text-[hsl(var(--muted-foreground))]">
              Ranked by progeny winners across the racing record
            </p>
          </div>
          <TrendingUp className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
        </div>

        {sires.length > 0 ? (
          <div className="giq-table-shell">
            <table className="w-full">
              <thead>
                <tr className="giq-table-head">
                  <th className="p-4 text-left tracking-[0.04em]">Sire</th>
                  <th className="p-4 text-right tracking-[0.04em]">Progeny</th>
                  <th className="p-4 text-right tracking-[0.04em]">Winners</th>
                  <th className="p-4 text-right tracking-[0.04em]">Winners / progeny</th>
                  <th className="p-4 text-right tracking-[0.04em]">Prize from wins</th>
                </tr>
              </thead>
              <tbody>
                {sires.map((s, i) => (
                  <tr key={s.sireId} className="giq-table-row">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <RankChip rank={i + 1} size="lg" />
                        <Link
                          href={`/breeding/sires/${s.sireId}`}
                          className="text-[14px] font-medium tracking-[-0.013em] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-bright))]"
                        >
                          {s.name}
                        </Link>
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono text-[13px] text-[hsl(var(--muted-foreground))]">{s.progeny}</td>
                    <td className="p-4 text-right font-mono text-[13px] text-[hsl(var(--muted-foreground))]">{s.winners}</td>
                    <td
                      className="p-4 text-right font-mono text-[13px] font-semibold text-[hsl(var(--primary-bright))]"
                      data-metric-state={s.strike === null ? "missing" : "measured"}
                    >
                      {s.strike === null ? "Not available" : `${s.strike}%`}
                    </td>
                    <td className="p-4 text-right font-mono text-[13px] text-[hsl(var(--foreground))]">{s.earnings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <RacingDataEmptyState
            title="Sire statistics are not available"
            description="No sire-leaderboard rows are present in the current read-only snapshot. GreyhoundIQ does not invent rankings or strike rates."
          />
        )}
        <p className="mt-4 text-[11px] tracking-[-0.01em] text-[hsl(var(--subtle-foreground))]">
          Winners = progeny that have won a race. &ldquo;Winners / progeny&rdquo;
          is over ALL mapped progeny (including studbook dogs that never raced),
          so it is not a runners-only strike rate. &ldquo;Prize from wins&rdquo;
          is prize money from winning runs only, not total career earnings.
        </p>
      </div>

      <div id="litters" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-20">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="mb-1 text-2xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
              Litter performance
            </h2>
            <p className="text-[13px] tracking-[-0.013em] text-[hsl(var(--muted-foreground))]">
              Sire × dam crosses that produced 2+ recorded progeny, ranked by winners
            </p>
          </div>
          <Layers className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
        </div>

        {litters.length > 0 ? (
          <div className="giq-table-shell">
            <table className="w-full">
              <thead>
                <tr className="giq-table-head">
                  <th className="p-4 text-left tracking-[0.04em]">Cross</th>
                  <th className="p-4 text-right tracking-[0.04em]">Progeny</th>
                  <th className="p-4 text-right tracking-[0.04em]">Winners</th>
                  <th className="p-4 text-right tracking-[0.04em]">Strike</th>
                  <th className="p-4 text-left tracking-[0.04em]">Nick vs parents</th>
                  <th className="p-4 text-right tracking-[0.04em]">$/progeny</th>
                  <th className="p-4 text-right tracking-[0.04em]">Prize money</th>
                  <th className="p-4 text-left tracking-[0.04em]">Top performer</th>
                </tr>
              </thead>
              <tbody>
                {litters.map((cross) => (
                  <LitterRow key={`${cross.sireId}|${cross.damId}`} cross={cross} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <RacingDataEmptyState
            title="No litter crosses are available"
            description="No sire and dam pairing has 2+ recorded progeny in the current snapshot. GreyhoundIQ does not invent litters."
          />
        )}

        <p className="mt-6 text-center text-[12px] tracking-[-0.013em] text-[hsl(var(--subtle-foreground))]">
          Pedigree drawn from the official studbook (8 volumes) and the racing record. Free to explore.{" "}
          <Link href="/dogs" className="text-[hsl(var(--primary-bright))] hover:underline">
            Browse all greyhounds
          </Link>{" "}
          or{" "}
          <Link href="/races" className="text-[hsl(var(--primary-bright))] hover:underline">
            follow today&rsquo;s races
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function LitterRow({ cross }: { cross: LitterCross }) {
  return (
    <tr className="giq-table-row">
      <td className="p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] tracking-[-0.013em]">
          <Link
            href={`/breeding/sires/${cross.sireId}`}
            className="font-medium text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-bright))]"
          >
            {cross.sireName}
          </Link>
          <span className="text-[hsl(var(--subtle-foreground))]">×</span>
          <Link
            href={`/breeding/dams/${cross.damId}`}
            className="font-medium text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-bright))]"
          >
            {cross.damName}
          </Link>
        </div>
      </td>
      <td className="p-4 text-right font-mono text-[13px] tabular-nums text-[hsl(var(--muted-foreground))]">
        {cross.progeny}
      </td>
      <td className="p-4 text-right font-mono text-[13px] font-semibold tabular-nums text-[hsl(var(--primary-bright))]">
        {cross.winners}
      </td>
      <td className="p-4 text-right font-mono text-[13px] tabular-nums text-[hsl(var(--foreground))]">
        {cross.strike === null ? "—" : `${cross.strike}%`}
      </td>
      <td className="p-4 text-left">
        <NickPill cross={cross} />
      </td>
      <td className="p-4 text-right font-mono text-[13px] tabular-nums text-[hsl(var(--muted-foreground))]">
        {cross.earningsPerProgeny > 0 ? formatEarnings(cross.earningsPerProgeny) : "—"}
      </td>
      <td className="p-4 text-right font-mono text-[13px] tabular-nums text-[hsl(var(--foreground))]">
        {cross.earnings > 0 ? formatEarnings(cross.earnings) : "—"}
      </td>
      <td className="p-4 text-[13px]">
        {cross.topPerformer ? (
          <Link
            href={`/dogs/${cross.topPerformer.id}`}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary-bright))]"
          >
            {cross.topPerformer.name}
          </Link>
        ) : (
          <span className="text-[hsl(var(--subtle-foreground))]">—</span>
        )}
      </td>
    </tr>
  );
}

/**
 * Flagship feature tile for the breeding suite. Renders the tool's icon, name and
 * one-line pitch with a live proof-of-value slot (`children`) and a directional
 * CTA. Purely presentational; the whole card is one link to the tool.
 */
function FeatureTile({
  href,
  icon: Icon,
  eyebrow,
  title,
  desc,
  cta,
  className,
  children,
}: {
  href: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`giq-panel giq-panel-hover group relative flex flex-col overflow-hidden p-5 sm:p-6 ${className ?? ""}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="giq-icon-plate flex h-11 w-11 items-center justify-center rounded-xl">
          <Icon className="h-5 w-5" />
        </span>
        <span className="giq-eyebrow pt-1 text-[hsl(var(--subtle-foreground))]">{eyebrow}</span>
      </div>
      <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
        {title}
      </h3>
      <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
        {desc}
      </p>
      <div className="mt-5 flex-1">{children}</div>
      <div className="mt-5 flex items-center gap-1.5 text-[12px] font-semibold tracking-[-0.01em] text-[hsl(var(--primary-bright))]">
        {cta}
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function TileChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[hsl(var(--metal-silver)/0.16)] bg-[hsl(0_0%_100%/0.03)] px-2.5 py-1 text-[11px] font-medium tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
      {children}
    </span>
  );
}

function RankChip({ rank, size = "sm" }: { rank: number; size?: "sm" | "lg" }) {
  const top = rank === 1;
  const box = size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums`}
      style={{
        background: top ? "hsl(var(--primary) / 0.20)" : "hsl(var(--surface-3))",
        color: top ? "hsl(var(--primary-bright))" : "hsl(var(--muted-foreground))",
      }}
    >
      {rank}
    </span>
  );
}

/**
 * Nicking verdict pill. Reads at a glance: gold "Outperforms" when the cross
 * beats both parents' baseline strike, red "Below both" when it trails both,
 * neutral "Mixed" otherwise. Renders an em dash when no honest verdict exists.
 */
function NickPill({ cross }: { cross: LitterCross }) {
  const verdict = nickVerdict(
    cross.strike,
    cross.sireBaselineStrike,
    cross.damBaselineStrike,
  );
  if (verdict === null) {
    return <span className="text-[11px] text-[hsl(var(--subtle-foreground))]">—</span>;
  }
  if (verdict === "over") {
    return (
      <span className="giq-status-pill giq-status-pill-gold">
        <TrendingUp className="h-3 w-3" /> Outperforms
      </span>
    );
  }
  if (verdict === "under") {
    return (
      <span className="giq-status-pill giq-status-pill-red">
        <TrendingDown className="h-3 w-3" /> Below both
      </span>
    );
  }
  return (
    <span className="giq-status-pill">
      <Minus className="h-3 w-3" /> Mixed
    </span>
  );
}
