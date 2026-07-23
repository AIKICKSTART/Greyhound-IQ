"use client";

import { Info, Loader2, GitBranch, Dna, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { CrossScanner } from "@/components/cross-scanner";
import { DogPicker, type PickedDog } from "@/components/dog-picker";
import { FutureLitter } from "@/components/future-litter";
import { PedigreeChart } from "@/components/pedigree-chart";
import type { PedigreeNode } from "@/lib/pedigree";
import type {
  CommonAncestor,
  PedigreeOverlapStatus,
} from "@/lib/pedigree-analysis";
import type {
  CrossRecord,
  DamPartner,
  ProgenyRecord,
  ProgenySummary,
} from "@/lib/queries";

function formatEarnings(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/** Honest sire/dam strike: winners among progeny that actually raced. */
function progenyStrike(record: ProgenyRecord): number | null {
  if (record.withRacingRecord <= 0 || record.winners === null) return null;
  return parseFloat(((record.winners / record.withRacingRecord) * 100).toFixed(1));
}

type CrossResponse = {
  cross: CrossRecord;
  sharedAncestors: CommonAncestor[];
  pedigreeStatus: PedigreeOverlapStatus;
  sireTree: PedigreeNode | null;
  damTree: PedigreeNode | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "loaded";
      cross: CrossRecord;
      sharedAncestors: CommonAncestor[];
      pedigreeStatus: PedigreeOverlapStatus;
      sireTree: PedigreeNode | null;
      damTree: PedigreeNode | null;
    };

/**
 * Cross analysis: pick a sire and a dam, then show the historical record of that
 * exact pairing plus each parent's overall progeny record. Explicitly not a
 * prediction — no genetics or trait modelling is performed anywhere.
 */
export function CrossAnalysis() {
  const [sire, setSire] = useState<PickedDog | null>(null);
  const [dam, setDam] = useState<PickedDog | null>(null);
  // `state` only matters once both parents are chosen; the idle prompt is
  // derived in render, so no setState fires synchronously from the effect.
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!sire || !dam) return;
    const controller = new AbortController();
    const run = async () => {
      setState({ status: "loading" });
      try {
        const res = await fetch(
          `/api/breeding/cross?sireId=${encodeURIComponent(sire.id)}&damId=${encodeURIComponent(dam.id)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("cross failed");
        const data: CrossResponse = await res.json();
        setState({
          status: "loaded",
          cross: data.cross,
          sharedAncestors: data.sharedAncestors ?? [],
          pedigreeStatus: data.pedigreeStatus ?? "incomplete",
          sireTree: data.sireTree ?? null,
          damTree: data.damTree ?? null,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setState({ status: "error" });
        }
      }
    };
    void run();
    return () => controller.abort();
  }, [sire, dam]);

  const bothSelected = Boolean(sire && dam);

  return (
    <div>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <DogPicker
          label="Sire"
          placeholder="Search a sire…"
          selected={sire}
          onSelect={setSire}
          onClear={() => setSire(null)}
        />
        <div className="hidden items-center justify-center pb-3 sm:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--metal-silver)/0.2)] bg-[hsl(0_0%_100%/0.04)] text-[15px] font-semibold text-[hsl(var(--muted-foreground))]">
            ×
          </span>
        </div>
        <DogPicker
          label="Dam"
          placeholder="Search a dam…"
          selected={dam}
          onSelect={setDam}
          onClear={() => setDam(null)}
        />
      </div>

      <div className="mt-8">
        {bothSelected && sire && dam ? (
          <CrossResult state={state} sireName={sire.name} damName={dam.name} />
        ) : sire && !dam ? (
          <TopPicks parent={sire} role="sire" onPick={setDam} />
        ) : dam && !sire ? (
          <TopPicks parent={dam} role="dam" onPick={setSire} />
        ) : (
          <CrossIdle />
        )}
      </div>
    </div>
  );
}

// After one parent is chosen, suggest its real breeding partners (dams it has
// produced progeny with, or sires for a dam) as one-click picks. Historical,
// not a prediction — only pairings present in the current snapshot.
function TopPicks({
  parent,
  role,
  onPick,
}: {
  parent: PickedDog;
  role: "sire" | "dam";
  onPick: (dog: PickedDog) => void;
}) {
  const [partners, setPartners] = useState<DamPartner[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const key = role === "sire" ? "sireId" : "damId";
    const run = async () => {
      setLoading(true);
      setPartners(null);
      try {
        const res = await fetch(
          `/api/breeding/cross/partners?${key}=${encodeURIComponent(parent.id)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("partners failed");
        const data: { partners: DamPartner[] } = await res.json();
        setPartners(data.partners ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setPartners([]);
      } finally {
        setLoading(false);
      }
    };
    void run();
    return () => controller.abort();
  }, [parent.id, role]);

  const otherLabel = role === "sire" ? "dam" : "sire";

  if (loading) {
    return (
      <div className="giq-panel flex items-center justify-center gap-3 p-8 text-[13px] text-[hsl(var(--muted-foreground))]">
        <Loader2 className="h-4 w-4 animate-spin" /> Finding {parent.name}&apos;s recorded partners…
      </div>
    );
  }

  if (!partners || partners.length === 0) {
    return (
      <div className="giq-dashed-panel p-8 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
        No recorded {otherLabel} partners for {parent.name} in the current snapshot. Search a{" "}
        {otherLabel} above to build the cross.
      </div>
    );
  }

  return (
    <section className="giq-panel p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="giq-icon-plate flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
              Top {otherLabel} picks for {parent.name}
            </h3>
            <span className="giq-status-pill giq-status-pill-purple">{partners.length}</span>
          </div>
          <p className="mt-1 max-w-2xl text-[12px] text-[hsl(var(--muted-foreground))]">
            {otherLabel === "dam" ? "Dams" : "Sires"} this {role} has recorded progeny with, most
            first. Pick one to complete the cross — a record of what has happened, not a prediction.
          </p>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {partners.map((partner) => (
          <li key={partner.id}>
            <button
              type="button"
              onClick={() => onPick({ id: partner.id, name: partner.name })}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--foreground)/0.025)] px-4 py-3 text-left transition-colors hover:border-[hsl(var(--primary-bright)/0.5)] hover:bg-[hsl(var(--foreground)/0.05)]"
            >
              <span className="min-w-0 truncate text-[14px] font-medium tracking-[-0.01em] text-[hsl(var(--foreground))]">
                {partner.name}
              </span>
              <span className="shrink-0 tabular-nums text-[11px] text-[hsl(var(--muted-foreground))]">
                {partner.progeny} progeny
                {partner.winners > 0 ? ` · ${partner.winners} winner${partner.winners === 1 ? "" : "s"}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Inviting idle state: shows what the tool will deliver before both parents are
// picked, instead of a blank prompt.
function CrossIdle() {
  return (
    <div className="giq-comparison-board">
      <div className="relative z-[2] flex flex-col items-center gap-5 px-4 py-10 text-center">
        <div className="flex items-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[hsl(var(--secondary-light)/0.3)] bg-[hsl(var(--secondary)/0.12)]">
            <Dna className="h-6 w-6 text-[hsl(var(--secondary-light))]" />
          </span>
          <span className="-ml-5 flex h-14 w-14 items-center justify-center rounded-full border border-[hsl(var(--primary-light)/0.3)] bg-[hsl(var(--primary)/0.16)] shadow-[0_0_26px_-12px_hsl(var(--primary-bright))]">
            <Dna className="h-6 w-6 text-[hsl(var(--primary-bright))]" />
          </span>
        </div>
        <div className="max-w-md">
          <p className="text-[16px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
            Pick a sire and a dam
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            See the shared ancestors the mating would carry, each parent&apos;s
            real progeny strike rate, and every pup the pairing has already
            produced.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <CrossChip>Shared ancestors</CrossChip>
          <CrossChip>Progeny record</CrossChip>
          <CrossChip>Real litter</CrossChip>
        </div>
      </div>
    </div>
  );
}

function CrossChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[hsl(var(--metal-silver)/0.16)] bg-[hsl(0_0%_100%/0.04)] px-2.5 py-1 text-[11px] font-medium tracking-[-0.01em] text-[hsl(var(--muted-foreground))]">
      {children}
    </span>
  );
}

function CrossResult({
  state,
  sireName,
  damName,
}: {
  state: LoadState;
  sireName: string;
  damName: string;
}) {
  if (state.status === "loading") {
    return <CrossScanner sireName={sireName} damName={damName} />;
  }
  if (state.status === "error") {
    return (
      <div className="giq-dashed-panel p-8 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
        Could not load this cross. Try again.
      </div>
    );
  }

  const { cross, sharedAncestors, pedigreeStatus, sireTree, damTree } = state;
  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 rounded-lg border border-[hsl(var(--secondary)/0.25)] bg-[hsl(var(--secondary)/0.08)] px-4 py-3 text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
        <Info className="h-4 w-4 shrink-0 text-[hsl(var(--secondary))]" />
        Historical cross record — not a prediction. GreyhoundIQ shows only what
        this pairing has actually produced.
      </p>

      <div className="giq-comparison-board">
        <div className="relative z-[2] grid items-stretch gap-4 sm:grid-cols-[1fr_2.5rem_1fr]">
          <ParentRecordCard
            title="Sire — overall progeny"
            name={cross.sire.name}
            href={`/breeding/sires/${cross.sire.id}`}
            record={cross.sireProgeny}
          />
          <div className="hidden items-center justify-center sm:flex">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--metal-silver)/0.22)] bg-[hsl(0_0%_100%/0.06)] text-[16px] font-semibold text-[hsl(var(--muted-foreground))]">
              ×
            </span>
          </div>
          <ParentRecordCard
            title="Dam — overall progeny"
            name={cross.dam.name}
            href={`/breeding/dams/${cross.dam.id}`}
            record={cross.damProgeny}
          />
        </div>
      </div>

      <SharedAncestors ancestors={sharedAncestors} status={pedigreeStatus} />

      {sireTree && damTree && (
        <FutureLitter
          sireTree={sireTree}
          damTree={damTree}
          sireName={cross.sire.name}
          damName={cross.dam.name}
        />
      )}

      {(sireTree || damTree) && (
        <section>
          <h3 className="mb-3 text-[15px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
            Family trees
          </h3>
          {sireTree && (
            <div className="mb-2">
              <p className="giq-eyebrow mb-2 text-[hsl(var(--subtle-foreground))]">
                {cross.sire.name} — sire line
              </p>
              <PedigreeChart root={sireTree} />
            </div>
          )}
          {damTree && (
            <div>
              <p className="giq-eyebrow mb-2 text-[hsl(var(--subtle-foreground))]">
                {cross.dam.name} — dam line
              </p>
              <PedigreeChart root={damTree} />
            </div>
          )}
        </section>
      )}

      <PairProgeny cross={cross} />
    </div>
  );
}

// Ancestors shared by both parents' pedigrees — the line-breeding a cross would
// carry. Historical and honest; absence is stated, never a fabricated match.
function SharedAncestors({
  ancestors,
  status,
}: {
  ancestors: CommonAncestor[];
  status: PedigreeOverlapStatus;
}) {
  const has = ancestors.length > 0;
  return (
    <section className="giq-panel p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="giq-icon-plate flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <GitBranch className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
              Shared ancestors
            </h3>
            {has && (
              <span className="giq-status-pill giq-status-pill-purple">
                {ancestors.length} found
              </span>
            )}
            {!has && status === "incomplete" && (
              <span className="giq-status-pill">Incomplete</span>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-[12px] text-[hsl(var(--muted-foreground))]">
            Ancestors that appear in both parents&apos; mapped pedigrees — the
            line-breeding this cross would carry. A record of lineage, not a
            prediction.
          </p>
        </div>
      </div>
      {has ? (
        <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {ancestors.slice(0, 8).map((ancestor) => (
            <li
              key={ancestor.key}
              className="flex items-baseline justify-between gap-2 text-[12px]"
            >
              <span className="min-w-0 truncate tracking-[-0.01em] text-[hsl(var(--foreground))]">
                {ancestor.name}
                {ancestor.whelpYear ? (
                  <span className="tabular-nums text-[hsl(var(--subtle-foreground))]">
                    {" "}
                    ({ancestor.whelpYear})
                  </span>
                ) : null}
                {ancestor.confidence === "name" && (
                  <span className="ml-1 text-[10px] uppercase tracking-[0.04em] text-[hsl(var(--subtle-foreground))]">
                    name-matched
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-[hsl(var(--muted-foreground))]">
                appears {ancestor.occurrences}×
              </span>
            </li>
          ))}
        </ul>
      ) : status === "outcross" ? (
        <div className="giq-dashed-panel p-5 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
          No common ancestor found across both mapped pedigrees — an outcross
          across the complete five-generation trees.
        </div>
      ) : (
        <div className="giq-dashed-panel p-5 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
          No shared ancestor can be confirmed yet. One or both pedigrees have
          missing ancestor slots, so GreyhoundIQ cannot label this cross an outcross.
        </div>
      )}
    </section>
  );
}

function PairProgeny({ cross }: { cross: CrossRecord }) {
  return (
    <section className="giq-panel p-5 sm:p-6">
      <h3 className="mb-1 text-[15px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
        {cross.sire.name} × {cross.dam.name}
      </h3>
      <p className="mb-5 text-[12px] text-[hsl(var(--muted-foreground))]">
        {cross.progeny.length > 0
          ? `${cross.progeny.length} recorded progeny of this exact pairing`
          : "No recorded progeny of this exact pairing"}
      </p>
      {cross.progeny.length > 0 ? (
        <div className="giq-table-shell">
          <table className="w-full">
            <thead>
              <tr className="giq-table-head">
                <th className="p-3 text-left tracking-[0.04em]">Progeny</th>
                <th className="p-3 text-right tracking-[0.04em]">Wins / Starts</th>
                <th className="p-3 text-right tracking-[0.04em]">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {cross.progeny.map((dog) => (
                <ProgenyRow key={dog.id} dog={dog} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="giq-dashed-panel p-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
          This sire and dam have no progeny recorded together in the current
          snapshot.
        </div>
      )}
    </section>
  );
}

function ProgenyRow({ dog }: { dog: ProgenySummary }) {
  const record =
    dog.careerStarts != null && dog.careerWins != null
      ? `${dog.careerWins}/${dog.careerStarts}`
      : null;
  return (
    <tr className="giq-table-row">
      <td className="p-3">
        <Link
          href={`/dogs/${dog.id}`}
          className="text-[14px] font-medium tracking-[-0.013em] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-bright))]"
        >
          {dog.name}
        </Link>
        {dog.whelpYear && (
          <span className="ml-2 text-[11px] tabular-nums text-[hsl(var(--subtle-foreground))]">
            {dog.whelpYear}
          </span>
        )}
      </td>
      <td className="p-3 text-right font-mono text-[13px] tabular-nums text-[hsl(var(--muted-foreground))]">
        {record ?? "—"}
      </td>
      <td className="p-3 text-right font-mono text-[13px] tabular-nums text-[hsl(var(--foreground))]">
        {dog.prizeMoney != null ? formatEarnings(dog.prizeMoney) : "—"}
      </td>
    </tr>
  );
}

function ParentRecordCard({
  title,
  name,
  href,
  record,
}: {
  title: string;
  name: string;
  href: string;
  record: ProgenyRecord;
}) {
  const strike = progenyStrike(record);
  const rows: { label: string; value: string | null }[] = [
    { label: "Progeny mapped", value: record.count.toLocaleString("en-AU") },
    {
      label: "With racing record",
      value: record.withRacingRecord.toLocaleString("en-AU"),
    },
    {
      label: "Winners (raced)",
      value: record.winners === null ? null : record.winners.toLocaleString("en-AU"),
    },
    {
      label: "Progeny career prize money",
      value: record.totalEarnings === null ? null : formatEarnings(record.totalEarnings),
    },
  ];
  return (
    <section className="giq-subpanel relative z-[2] flex flex-col p-5">
      <p className="giq-eyebrow mb-1 text-[hsl(var(--subtle-foreground))]">{title}</p>
      <Link
        href={href}
        className="text-[15px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-bright))]"
      >
        {name}
      </Link>
      <div className="mt-4" data-metric-state={strike === null ? "missing" : "measured"}>
        <p
          className={
            strike === null
              ? "text-[18px] font-semibold leading-none tracking-[-0.02em] text-[hsl(var(--subtle-foreground))]"
              : "text-[40px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[hsl(var(--primary-bright))]"
          }
        >
          {strike === null ? "Not available" : `${strike}%`}
        </p>
        <p className="giq-eyebrow mt-1.5 text-[hsl(var(--subtle-foreground))]">
          strike rate (of racers)
        </p>
      </div>
      <dl className="mt-4 space-y-2 border-t border-[hsl(var(--border-subtle))] pt-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <dt className="text-[12px] text-[hsl(var(--muted-foreground))]">{row.label}</dt>
            <dd
              className={`font-mono text-[13px] tabular-nums ${
                row.value === null
                  ? "text-[hsl(var(--subtle-foreground))]"
                  : "text-[hsl(var(--foreground))]"
              }`}
              data-metric-state={row.value === null ? "missing" : "measured"}
            >
              {row.value ?? "Not available"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
