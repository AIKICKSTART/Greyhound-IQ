"use client";

import { Dna, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PedigreeTree } from "@/components/pedigree-tree";
import type { PedigreeNode } from "@/lib/pedigree";
import {
  bloodQuota,
  wrightCoefficient,
  type AncestorLoss,
  type BloodAncestor,
  type BloodGenCount,
  type InbreedingAnalysis,
} from "@/lib/pedigree-analysis";

const GENERATIONS = 5;
const SEARCH_DEBOUNCE_MS = 150;

interface FutureLitterProps {
  sireTree: PedigreeNode;
  damTree: PedigreeNode;
  sireName: string;
  damName: string;
}

interface MatchCounts {
  total: number;
  sire: number;
  dam: number;
}

// Count every ancestor card whose name matches, split by which parent's side of
// the combined tree it sits on. Mirrors the per-card highlight in PedigreeTree.
function countMatches(root: PedigreeNode, query: string): MatchCounts {
  const q = query.trim().toLowerCase();
  if (!q) return { total: 0, sire: 0, dam: 0 };
  const countSide = (node: PedigreeNode | undefined): number => {
    if (!node) return 0;
    const self = node.name !== "Unknown" && node.name.toLowerCase().includes(q) ? 1 : 0;
    return self + countSide(node.sire) + countSide(node.dam);
  };
  const sire = countSide(root.sire);
  const dam = countSide(root.dam);
  return { total: sire + dam, sire, dam };
}

// Descriptive of the number only — never breeding advice or a health claim.
function coiBand(coiPct: number): string {
  if (coiPct <= 0) return "No shared lineage within the mapped generations";
  if (coiPct < 6.25) return "Slight line-breeding within the mapped generations";
  if (coiPct < 12.5) return "Notable line-breeding within the mapped generations";
  if (coiPct < 25) return "Strong line-breeding within the mapped generations";
  return "Very strong line-breeding within the mapped generations";
}

/**
 * "Future litter": the pedigree a pup from this exact sire × dam mating would
 * carry. A synthetic root joins both parent trees into one interactive tree,
 * with Wright's coefficient of inbreeding and a live ancestor search over both
 * sides. Deterministic lineage fact only — nothing here predicts performance.
 */
export function FutureLitter({ sireTree, damTree, sireName, damName }: FutureLitterProps) {
  const root = useMemo<PedigreeNode>(
    () => ({
      id: null,
      name: "Future litter",
      sex: null,
      colour: null,
      whelpYear: null,
      careerStarts: null,
      careerWins: null,
      prizeMoney: null,
      sire: sireTree,
      dam: damTree,
    }),
    [sireTree, damTree],
  );

  const inbreeding = useMemo(
    () => wrightCoefficient(sireTree, damTree, GENERATIONS),
    [sireTree, damTree],
  );
  const blood = useMemo(
    () => bloodQuota(sireTree, damTree, GENERATIONS),
    [sireTree, damTree],
  );
  // Ancestors on both sides drive the "Line-bred" chips — same set the COI sums.
  const highlightKeys = useMemo(
    () => inbreeding.contributions.map((c) => c.key),
    [inbreeding],
  );

  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const matches = useMemo(() => countMatches(root, query), [root, query]);

  return (
    <section className="giq-panel p-5 sm:p-6" aria-label="Future litter pedigree">
      <div className="mb-5 flex items-start gap-3">
        <span className="giq-icon-plate flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Dna className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
            Future litter
          </h3>
          <p className="mt-1 max-w-2xl text-[12px] text-[hsl(var(--muted-foreground))]">
            The pedigree a pup from {sireName} × {damName} would carry, drawn from
            both parents&apos; mapped lineage. Deterministic ancestry — not a
            performance prediction.
          </p>
        </div>
      </div>

      <InbreedingPanel analysis={inbreeding} ancestorLoss={blood.ancestorLoss} />

      <BloodQuotaTable ancestors={blood.doubleAncestors} generations={GENERATIONS} />

      <div className="mb-4 mt-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--subtle-foreground))]" />
          <input
            type="text"
            value={rawQuery}
            onChange={(event) => setRawQuery(event.target.value)}
            placeholder="Search this pedigree…"
            aria-label="Search ancestors across the combined pedigree"
            className="giq-form-control pl-9 pr-9"
          />
          {rawQuery && (
            <button
              type="button"
              onClick={() => setRawQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[hsl(var(--subtle-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {query && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
            {matches.total > 0 ? (
              <>
                <span className="giq-status-pill giq-status-pill-purple">
                  {matches.total} {matches.total === 1 ? "match" : "matches"}
                </span>
                <span className="tabular-nums">
                  {matches.sire} sire side · {matches.dam} dam side
                </span>
                <span className="text-[hsl(var(--subtle-foreground))]">
                  · deeper matches may sit off-screen — open a +gens chip to reach them
                </span>
              </>
            ) : (
              <span>No ancestor matches “{rawQuery.trim()}”.</span>
            )}
          </p>
        )}
      </div>

      <div className="max-w-full touch-pan-x overflow-x-auto overscroll-x-contain pb-3">
        <div className="w-max min-w-full pr-1">
          <PedigreeTree
            root={root}
            highlightKeys={highlightKeys}
            highlightQuery={query}
            rootSubtitle={`${sireName} × ${damName}`}
          />
        </div>
      </div>
    </section>
  );
}

function InbreedingPanel({
  analysis,
  ancestorLoss,
}: {
  analysis: InbreedingAnalysis;
  ancestorLoss: AncestorLoss;
}) {
  const { coiPct, contributions, incomplete } = analysis;
  return (
    <div className="giq-subpanel p-4 sm:p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="giq-eyebrow text-[hsl(var(--subtle-foreground))]">
            Coefficient of inbreeding (Wright&apos;s)
          </p>
          <p className="mb-2 text-[10px] uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
            Double coefficient · mapped generations
          </p>
          <p className="text-[40px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[hsl(var(--secondary-light))]">
            {coiPct.toFixed(1)}%
          </p>
          <p className="mt-2 max-w-[220px] text-[12px] leading-snug text-[hsl(var(--muted-foreground))]">
            {coiBand(coiPct)}
          </p>
        </div>

        <div>
          <p className="giq-eyebrow text-[hsl(var(--subtle-foreground))]">
            Ancestor loss ({ancestorLoss.generations} mapped generations)
          </p>
          <p className="mb-2 text-[10px] uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
            Higher = more ancestor duplication
          </p>
          <p className="text-[40px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[hsl(var(--primary-bright))]">
            {ancestorLoss.lossPct.toFixed(1)}%
          </p>
          <p className="mt-2 max-w-[240px] text-[12px] leading-snug text-[hsl(var(--muted-foreground))]">
            {ancestorLoss.uniqueAncestors} distinct across{" "}
            {ancestorLoss.mappedPositions} mapped positions · 0% = every ancestor
            unique
          </p>
        </div>
      </div>

      {contributions.length > 0 && (
        <div className="mt-5 border-t border-[hsl(var(--border-subtle))] pt-4">
          <p className="giq-eyebrow mb-2 text-[hsl(var(--subtle-foreground))]">
            Top contributing ancestors
          </p>
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {contributions.slice(0, 5).map((ancestor) => (
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
                    <span className="ml-1.5 text-[10px] tabular-nums text-[hsl(var(--subtle-foreground))]">
                      {ancestor.sireOccurrences}× sire · {ancestor.damOccurrences}× dam
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-[hsl(var(--secondary-light))]">
                    +{ancestor.contributionPct.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

      <p className="mt-4 border-t border-[hsl(var(--border-subtle))] pt-3 text-[11px] leading-relaxed text-[hsl(var(--subtle-foreground))]">
        Covers only the {GENERATIONS} mapped generations shown and treats each
        ancestor as non-inbred, so the true figure can be higher where records run
        deeper.
        {incomplete
          ? " One or both pedigrees are materially incomplete — read this as a floor, not a full account."
          : ""}
      </p>
    </div>
  );
}

// Blood quota of double ancestors: every ancestor sitting in two or more
// positions across the combined pedigree, by share of the litter's blood.
// Desktop shows a per-generation grid (gold = sire side, purple = dam side);
// mobile condenses each row's generations into badges so 390px never scrolls
// the page (the table itself may scroll inside its own container).
function BloodQuotaTable({
  ancestors,
  generations,
}: {
  ancestors: BloodAncestor[];
  generations: number;
}) {
  if (ancestors.length === 0) return null;
  const gens = Array.from({ length: generations }, (_, i) => i + 1);
  return (
    <div className="mt-6">
      <p className="giq-eyebrow mb-1 text-[hsl(var(--subtle-foreground))]">
        Blood quota of double ancestors
      </p>
      <p className="mb-2 text-[12px] text-[hsl(var(--muted-foreground))]">
        Ancestors in two or more positions of the combined pedigree, by share of
        the litter&apos;s blood within the {generations} mapped generations.
      </p>
      <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[hsl(var(--subtle-foreground))]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--secondary))]" /> Sire side
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary-bright))]" /> Dam side
        </span>
        <span>Per-generation cells and badges count occurrences per side.</span>
      </p>
      <div className="giq-table-shell max-w-full touch-pan-x overflow-x-auto overscroll-x-contain">
        <table className="w-full">
          <thead>
            <tr className="giq-table-head">
              <th className="p-2.5 text-left tracking-[0.04em]">Ancestor</th>
              <th className="p-2.5 text-right tracking-[0.04em]">Blood</th>
              <th className="p-2.5 text-right tracking-[0.04em]">Sire</th>
              <th className="p-2.5 text-right tracking-[0.04em]">Dam</th>
              {gens.map((gen) => (
                <th
                  key={gen}
                  className="hidden p-2.5 text-center tabular-nums tracking-[0.04em] sm:table-cell"
                >
                  G{gen}
                </th>
              ))}
              <th className="p-2.5 text-left tracking-[0.04em] sm:hidden">Gens</th>
            </tr>
          </thead>
          <tbody>
            {ancestors.map((ancestor) => (
              <BloodRow key={ancestor.key} ancestor={ancestor} gens={gens} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BloodRow({ ancestor, gens }: { ancestor: BloodAncestor; gens: number[] }) {
  const byGen = new Map(ancestor.byGen.map((g) => [g.gen, g]));
  return (
    <tr className="giq-table-row">
      <td className="p-2.5">
        <span className="block max-w-[160px] truncate text-[13px] font-medium tracking-[-0.01em] text-[hsl(var(--foreground))]">
          {ancestor.name}
          {ancestor.whelpYear ? (
            <span className="ml-1 text-[11px] tabular-nums text-[hsl(var(--subtle-foreground))]">
              ({ancestor.whelpYear})
            </span>
          ) : null}
        </span>
      </td>
      <td className="p-2.5 text-right font-mono text-[13px] font-semibold tabular-nums text-[hsl(var(--secondary-light))]">
        {ancestor.totalPct.toFixed(1)}%
      </td>
      <td className="p-2.5 text-right font-mono text-[12px] tabular-nums text-[hsl(var(--secondary))]">
        {ancestor.sirePct.toFixed(1)}
      </td>
      <td className="p-2.5 text-right font-mono text-[12px] tabular-nums text-[hsl(var(--primary-bright))]">
        {ancestor.damPct.toFixed(1)}
      </td>
      {gens.map((gen) => {
        const cell = byGen.get(gen);
        return (
          <td key={gen} className="hidden p-2.5 text-center sm:table-cell">
            <GenCell sire={cell?.sire ?? 0} dam={cell?.dam ?? 0} />
          </td>
        );
      })}
      <td className="p-2.5 text-left sm:hidden">
        <GenBadges byGen={ancestor.byGen} />
      </td>
    </tr>
  );
}

function GenCell({ sire, dam }: { sire: number; dam: number }) {
  if (sire === 0 && dam === 0) {
    return <span className="text-[hsl(var(--subtle-foreground))]">·</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums">
      {sire > 0 && <span className="text-[hsl(var(--secondary))]">{sire}</span>}
      {dam > 0 && <span className="text-[hsl(var(--primary-bright))]">{dam}</span>}
    </span>
  );
}

function GenBadges({ byGen }: { byGen: BloodGenCount[] }) {
  const active = byGen.filter((g) => g.sire > 0 || g.dam > 0);
  return (
    <span className="flex flex-wrap gap-1">
      {active.map((g) => (
        <span
          key={g.gen}
          className="inline-flex items-center gap-1 rounded-sm bg-[hsl(var(--foreground)/0.06)] px-1.5 py-0.5 text-[10px] tabular-nums"
        >
          <span className="text-[hsl(var(--subtle-foreground))]">G{g.gen}</span>
          {g.sire > 0 && <span className="text-[hsl(var(--secondary))]">{g.sire}</span>}
          {g.dam > 0 && <span className="text-[hsl(var(--primary-bright))]">{g.dam}</span>}
        </span>
      ))}
    </span>
  );
}
