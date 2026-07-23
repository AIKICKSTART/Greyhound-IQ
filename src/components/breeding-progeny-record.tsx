import { GitBranch, Trophy } from "lucide-react";
import Link from "next/link";

import { RacingDataEmptyState } from "@/components/racing-data-empty-state";
import type { ProgenyRecord, ProgenySummary } from "@/lib/queries";

function formatEarnings(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-AU");
}

/** Honest strike: winners among progeny that actually raced. Null when none raced. */
export function progenyStrike(progeny: ProgenyRecord): number | null {
  if (progeny.withRacingRecord <= 0 || progeny.winners === null) return null;
  return parseFloat(((progeny.winners / progeny.withRacingRecord) * 100).toFixed(1));
}

/** A stat that is genuinely unknown renders as "Not available", never as 0. */
function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | null;
  accent?: boolean;
}) {
  const missing = value === null;
  return (
    <div className="giq-metric-card p-4" data-metric-state={missing ? "missing" : "measured"}>
      <p
        className={`text-[22px] font-semibold tabular-nums tracking-[-0.02em] ${
          missing
            ? "text-[hsl(var(--subtle-foreground))]"
            : accent
              ? "text-[hsl(var(--primary-bright))]"
              : "text-[hsl(var(--foreground))]"
        }`}
      >
        {missing ? "Not available" : value}
      </p>
      <p className="mt-0.5 text-[11px] tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
    </div>
  );
}

function progenyMetrics(progeny: ProgenyRecord) {
  return [
    { label: "Progeny mapped", value: formatNumber(progeny.count), accent: false },
    {
      label: "With racing record",
      value: formatNumber(progeny.withRacingRecord),
      accent: false,
    },
    {
      label: "Winners (raced)",
      value: progeny.winners === null ? null : formatNumber(progeny.winners),
      accent: true,
    },
    {
      label: "Progeny career prize money",
      value: progeny.totalEarnings === null ? null : formatEarnings(progeny.totalEarnings),
      accent: false,
    },
  ];
}

function ProgenyRow({ dog, rank }: { dog: ProgenySummary; rank: number }) {
  const record =
    dog.careerStarts != null && dog.careerWins != null
      ? `${dog.careerWins}/${dog.careerStarts}`
      : null;
  const isBest = rank === 1;
  return (
    <tr className={`giq-table-row ${isBest ? "bg-[hsl(var(--primary)/0.06)]" : ""}`}>
      <td className={`p-4 ${isBest ? "border-l-2 border-[hsl(var(--primary-bright))]" : ""}`}>
        <div className="flex items-center gap-3">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold tabular-nums"
            style={{
              background: isBest ? "hsl(var(--primary) / 0.20)" : "hsl(var(--surface-3))",
              color: isBest ? "hsl(var(--primary-bright))" : "hsl(var(--muted-foreground))",
            }}
          >
            {rank}
          </span>
          <Link
            href={`/dogs/${dog.id}`}
            className="text-[14px] font-medium tracking-[-0.013em] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-bright))]"
          >
            {dog.name}
          </Link>
          {isBest && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--secondary-light)/0.36)] bg-[hsl(var(--secondary)/0.12)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[hsl(var(--secondary-light))]">
              <Trophy className="h-2.5 w-2.5" /> Best
            </span>
          )}
        </div>
      </td>
      <td className="p-4 text-right font-mono text-[13px] tabular-nums text-[hsl(var(--muted-foreground))]">
        {record ?? "—"}
      </td>
      <td className="p-4 text-right font-mono text-[13px] tabular-nums text-[hsl(var(--foreground))]">
        {dog.prizeMoney != null ? formatEarnings(dog.prizeMoney) : "—"}
      </td>
    </tr>
  );
}

interface BreedingProgenyRecordProps {
  progeny: ProgenyRecord;
  topProgeny: ProgenySummary[];
  emptyDescription: string;
}

/**
 * Shared progeny record for a breeding parent (sire or dam): an honest strike
 * headline (racing progeny only), the progeny aggregate grid, and a top-progeny
 * table. Every unknown figure renders "Not available"; nothing is fabricated.
 */
export function BreedingProgenyRecord({
  progeny,
  topProgeny,
  emptyDescription,
}: BreedingProgenyRecordProps) {
  const strike = progenyStrike(progeny);
  return (
    <>
      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
            Progeny record
          </h2>
        </div>

        <div
          className="giq-panel relative mb-3 flex flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          data-metric-state={strike === null ? "missing" : "measured"}
        >
          <div className="max-w-md">
            <p className="giq-eyebrow mb-2 text-[hsl(var(--subtle-foreground))]">
              Progeny strike rate
            </p>
            <p className="text-[13px] leading-relaxed tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
              Winners among progeny that actually raced — the honest denominator.
              Never studbook-only dogs that never started.
            </p>
          </div>
          <p
            className={
              strike === null
                ? "text-[20px] font-semibold leading-none tracking-[-0.02em] text-[hsl(var(--subtle-foreground))]"
                : "text-[52px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[hsl(var(--primary-bright))] sm:text-[60px]"
            }
          >
            {strike === null ? "Not available" : `${strike}%`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {progenyMetrics(progeny).map((m) => (
            <MetricCard key={m.label} label={m.label} value={m.value} accent={m.accent} />
          ))}
        </div>
        {progeny.avgCareerWins !== null && (
          <p className="mt-3 text-[12px] tabular-nums text-[hsl(var(--subtle-foreground))]">
            Average career wins per progeny: {progeny.avgCareerWins.toFixed(1)}
          </p>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
            Top progeny by earnings
          </h2>
        </div>
        {topProgeny.length > 0 ? (
          <div className="giq-table-shell">
            <table className="w-full">
              <thead>
                <tr className="giq-table-head">
                  <th className="p-4 text-left tracking-[0.04em]">Progeny</th>
                  <th className="p-4 text-right tracking-[0.04em]">Wins / Starts</th>
                  <th className="p-4 text-right tracking-[0.04em]">Prize money</th>
                </tr>
              </thead>
              <tbody>
                {topProgeny.map((p, i) => (
                  <ProgenyRow key={p.id} dog={p} rank={i + 1} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <RacingDataEmptyState
            title="No progeny with a racing record"
            description={emptyDescription}
          />
        )}
      </section>
    </>
  );
}
