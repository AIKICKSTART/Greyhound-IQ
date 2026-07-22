import { ArrowLeft, Layers, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BreedingProgenyRecord } from "@/components/breeding-progeny-record";
import { JsonLd, breadcrumbSchema } from "@/components/json-ld";
import { RacingDataDisclosure } from "@/components/racing-data-disclosure";
import { nickVerdict } from "@/lib/nicking";
import { getLitters, getSireStats, type LitterCross } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stats = await getSireStats(id);
  if (!stats) {
    return {
      title: "Sire not found — GreyhoundIQ",
      description: "Sire statistics not found in the national database.",
    };
  }
  const description = `Progeny record and top performers for the greyhound sire ${stats.dog.name}, drawn from the racing record.`;
  return {
    title: `${stats.dog.name} — Sire Statistics | GreyhoundIQ`,
    description,
    alternates: { canonical: `/breeding/sires/${id}` },
  };
}

function formatEarnings(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default async function SireDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [stats, litters] = await Promise.all([getSireStats(id), getLitters(id, 12)]);
  if (!stats) notFound();

  const { dog, progeny, topProgeny } = stats;
  const ownRecord =
    dog.careerStarts != null && dog.careerWins != null
      ? `${dog.careerWins} wins from ${dog.careerStarts} starts`
      : null;
  const meta = [
    dog.sex === "M" ? "Dog" : dog.sex === "F" ? "Bitch" : null,
    dog.colour,
    dog.whelpYear ? String(dog.whelpYear) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Breeding", path: "/breeding" },
            { name: dog.name, path: `/breeding/sires/${dog.id}` },
          ]),
        ]}
      />
      <RacingDataDisclosure className="mb-8" />

      <Link
        href="/breeding"
        className="mb-6 inline-flex items-center gap-2 text-[13px] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" /> Breeding intelligence
      </Link>

      <header className="mb-8">
        <p className="giq-eyebrow mb-2 text-[hsl(var(--subtle-foreground))]">Sire statistics</p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))] sm:text-4xl">
          {dog.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-[hsl(var(--muted-foreground))]">
          {meta && <span>{meta}</span>}
          {ownRecord && (
            <span className="tabular-nums">
              · {ownRecord}
              {dog.prizeMoney != null ? ` · ${formatEarnings(dog.prizeMoney)}` : ""}
            </span>
          )}
          <Link href={`/dogs/${dog.id}`} className="text-[hsl(var(--primary-bright))] hover:underline">
            · Full profile
          </Link>
        </div>
      </header>

      <BreedingProgenyRecord
        progeny={progeny}
        topProgeny={topProgeny}
        emptyDescription="No progeny of this sire carry earnings in the current snapshot. GreyhoundIQ does not invent progeny results."
      />

      <TopDamPartners litters={litters} />
    </div>
  );
}

function NickBadge({ cross }: { cross: LitterCross }) {
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

/**
 * Best crosses for this sire: real litters (2+ recorded progeny), each rated
 * against both parents' overall progeny winners-rate. Strike + prize-per-progeny
 * keep big litters from dominating on totals alone. All from Dog aggregates.
 */
function TopDamPartners({ litters }: { litters: LitterCross[] }) {
  if (litters.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center gap-2">
        <Layers className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
          Top dam partners (best crosses)
        </h2>
      </div>
      <div className="giq-table-shell">
        <table className="w-full">
          <thead>
            <tr className="giq-table-head">
              <th className="p-4 text-left tracking-[0.04em]">Dam</th>
              <th className="p-4 text-right tracking-[0.04em]">Progeny</th>
              <th className="p-4 text-right tracking-[0.04em]">Winners</th>
              <th className="p-4 text-right tracking-[0.04em]">Strike</th>
              <th className="p-4 text-right tracking-[0.04em]">$/progeny</th>
              <th className="p-4 text-left tracking-[0.04em]">Nick vs parents</th>
            </tr>
          </thead>
          <tbody>
            {litters.map((cross) => (
              <tr key={`${cross.sireId}|${cross.damId}`} className="giq-table-row">
                <td className="p-4">
                  <Link
                    href={`/breeding/dams/${cross.damId}`}
                    className="text-[14px] font-medium tracking-[-0.013em] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-bright))]"
                  >
                    {cross.damName}
                  </Link>
                </td>
                <td className="p-4 text-right font-mono text-[13px] tabular-nums text-[hsl(var(--muted-foreground))]">
                  {cross.progeny}
                </td>
                <td className="p-4 text-right font-mono text-[13px] tabular-nums text-[hsl(var(--muted-foreground))]">
                  {cross.winners}
                </td>
                <td className="p-4 text-right font-mono text-[13px] font-semibold tabular-nums text-[hsl(var(--primary-bright))]">
                  {cross.strike === null ? "—" : `${cross.strike}%`}
                </td>
                <td className="p-4 text-right font-mono text-[13px] tabular-nums text-[hsl(var(--foreground))]">
                  {cross.earningsPerProgeny > 0
                    ? formatEarnings(cross.earningsPerProgeny)
                    : "—"}
                </td>
                <td className="p-4 text-left">
                  <NickBadge cross={cross} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] tracking-[-0.01em] text-[hsl(var(--subtle-foreground))]">
        Nick compares each cross&apos;s winners rate to both parents&apos; overall
        progeny winners rate. A record of what these pairings produced — not a
        prediction.
      </p>
    </section>
  );
}
