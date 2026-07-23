import type { PedigreeNode } from "@/lib/pedigree";

/**
 * In-memory pedigree analysis. Zero queries: every function operates on a
 * PedigreeNode tree already loaded by getDogPedigree. Nothing here predicts or
 * fabricates — it only reports what the loaded ancestry contains.
 */

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Stable identity for an ancestor. Prefers the stored id; id-less (studbook
 * name-only) nodes fall back to a normalized name. Returns null for unknown /
 * unnamed placeholder nodes, which must never count as a shared ancestor.
 */
export function nodeKey(node: PedigreeNode): string | null {
  if (node.id) return `id:${node.id}`;
  const normalized = normalizeName(node.name);
  if (!normalized || normalized === "unknown") return null;
  return `name:${normalized}`;
}

interface Occurrence {
  key: string;
  name: string;
  whelpYear: number | null;
  prizeMoney: number | null;
  count: number;
  linked: boolean;
}

function collectAncestors(
  node: PedigreeNode | undefined,
  acc: Map<string, Occurrence> = new Map(),
): Map<string, Occurrence> {
  if (!node) return acc;
  const key = nodeKey(node);
  if (key) {
    const existing = acc.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      acc.set(key, {
        key,
        name: node.name,
        whelpYear: node.whelpYear,
        prizeMoney: node.prizeMoney,
        count: 1,
        linked: key.startsWith("id:"),
      });
    }
  }
  collectAncestors(node.sire, acc);
  collectAncestors(node.dam, acc);
  return acc;
}

export interface CommonAncestor {
  key: string;
  name: string;
  whelpYear: number | null;
  prizeMoney: number | null;
  occurrences: number;
  confidence: "linked" | "name";
}

function intersect(
  a: Map<string, Occurrence>,
  b: Map<string, Occurrence>,
): CommonAncestor[] {
  const common: CommonAncestor[] = [];
  for (const [key, left] of a) {
    const right = b.get(key);
    if (!right) continue;
    common.push({
      key,
      name: left.name,
      whelpYear: left.whelpYear,
      prizeMoney: left.prizeMoney,
      occurrences: left.count + right.count,
      confidence: left.linked && right.linked ? "linked" : "name",
    });
  }
  return common.sort(
    (x, y) => y.occurrences - x.occurrences || x.name.localeCompare(y.name),
  );
}

/**
 * Ancestors appearing on BOTH the sire and dam side of one dog's tree — the
 * line-breeding / inbreeding signal. id-matched ancestors are high confidence;
 * name-only (studbook) matches are flagged lower confidence.
 */
export function findCommonAncestors(root: PedigreeNode): CommonAncestor[] {
  return intersect(collectAncestors(root.sire), collectAncestors(root.dam));
}

/**
 * Shared ancestors of two prospective parents — intersect their full pedigrees.
 * Historical and honest: shows the lineage overlap a cross WOULD carry, not a
 * prediction of the offspring.
 */
export function sharedAncestors(
  sireTree: PedigreeNode,
  damTree: PedigreeNode,
): CommonAncestor[] {
  return intersect(collectAncestors(sireTree), collectAncestors(damTree));
}

export type PedigreeOverlapStatus = "shared" | "outcross" | "incomplete";

export interface PedigreeCompleteness {
  filled: number;
  total: number;
  pct: number;
  generations: number;
}

/**
 * Filled ancestor slots vs a full binary pedigree of `generations` depth
 * (2^1 + … + 2^gens = 2^(gens+1) − 2 slots). The subject (root) is excluded.
 */
export function pedigreeCompleteness(
  root: PedigreeNode,
  generations: number,
): PedigreeCompleteness {
  const gens = Math.max(0, Math.trunc(generations));
  const total = gens > 0 ? 2 ** (gens + 1) - 2 : 0;
  let filled = 0;
  const walk = (node: PedigreeNode | undefined, depth: number): void => {
    if (!node || depth > gens) return;
    if (depth >= 1 && nodeKey(node)) filled += 1;
    walk(node.sire, depth + 1);
    walk(node.dam, depth + 1);
  };
  walk(root, 0);
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, pct, generations: gens };
}

export interface PedigreeOverlapAnalysis {
  commonAncestors: CommonAncestor[];
  sireCompleteness: PedigreeCompleteness | null;
  damCompleteness: PedigreeCompleteness | null;
  status: PedigreeOverlapStatus;
}

/**
 * Classify a prospective cross without turning missing ancestry into evidence.
 * "Outcross" is only defensible when both requested trees are complete.
 */
export function analyzePedigreeOverlap(
  sireTree: PedigreeNode | null,
  damTree: PedigreeNode | null,
  generations: number,
): PedigreeOverlapAnalysis {
  const commonAncestors =
    sireTree && damTree ? sharedAncestors(sireTree, damTree) : [];
  const sireCompleteness = sireTree
    ? pedigreeCompleteness(sireTree, generations)
    : null;
  const damCompleteness = damTree
    ? pedigreeCompleteness(damTree, generations)
    : null;
  const status: PedigreeOverlapStatus =
    commonAncestors.length > 0
      ? "shared"
      : sireCompleteness?.pct === 100 && damCompleteness?.pct === 100
        ? "outcross"
        : "incomplete";

  return { commonAncestors, sireCompleteness, damCompleteness, status };
}

export interface TopAncestor {
  id: string | null;
  name: string;
  prizeMoney: number;
}

/**
 * Highest prize-money ancestor anywhere in the tree (subject excluded). Null
 * when no ancestor carries a positive, real earning — never a fabricated zero.
 */
export function highestEarningAncestor(root: PedigreeNode): TopAncestor | null {
  let best: TopAncestor | null = null;
  const walk = (node: PedigreeNode | undefined, isRoot: boolean): void => {
    if (!node) return;
    if (
      !isRoot &&
      node.prizeMoney != null &&
      node.prizeMoney > 0 &&
      (!best || node.prizeMoney > best.prizeMoney)
    ) {
      best = { id: node.id, name: node.name, prizeMoney: node.prizeMoney };
    }
    walk(node.sire, false);
    walk(node.dam, false);
  };
  walk(root, true);
  return best;
}

export interface PedigreeAnalysis {
  commonAncestors: CommonAncestor[];
  completeness: PedigreeCompleteness;
  topEarner: TopAncestor | null;
}

export function analyzePedigree(
  root: PedigreeNode,
  generations: number,
): PedigreeAnalysis {
  return {
    commonAncestors: findCommonAncestors(root),
    completeness: pedigreeCompleteness(root, generations),
    topEarner: highestEarningAncestor(root),
  };
}

// ---------------------------------------------------------------------------
// Inbreeding — Wright's coefficient of inbreeding for a prospective offspring.
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

interface AncestorPath {
  /** Edges from the tree root (the prospective parent) to this occurrence. */
  depth: number;
  /** nodeKeys on the root→node path, excluding unkeyed placeholders. */
  members: Set<string>;
}

interface AncestorMeta {
  name: string;
  whelpYear: number | null;
}

// Enumerate every root→ancestor path, grouped by nodeKey. `depth` counts edges
// from the root, so the parent (root) is depth 0, its parents depth 1, etc.
function collectAncestorPaths(
  node: PedigreeNode | undefined,
  depth: number,
  ancestry: string[],
  paths: Map<string, AncestorPath[]>,
  meta: Map<string, AncestorMeta>,
): void {
  if (!node) return;
  const key = nodeKey(node);
  const chain = key ? [...ancestry, key] : ancestry;
  if (key) {
    const entry: AncestorPath = { depth, members: new Set(chain) };
    const list = paths.get(key);
    if (list) list.push(entry);
    else paths.set(key, [entry]);
    if (!meta.has(key)) meta.set(key, { name: node.name, whelpYear: node.whelpYear });
  }
  collectAncestorPaths(node.sire, depth + 1, chain, paths, meta);
  collectAncestorPaths(node.dam, depth + 1, chain, paths, meta);
}

// A Wright loop is valid only when the sire-side and dam-side chains meet at the
// common ancestor and share no other individual — otherwise a nearer common
// ancestor already accounts for the overlap and this longer path double-counts.
// (This is what keeps a parent-offspring mating at 25% rather than overshooting.)
function meetsOnlyAt(a: Set<string>, b: Set<string>, key: string): boolean {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const member of small) {
    if (member !== key && large.has(member)) return false;
  }
  return true;
}

export interface InbreedingContribution {
  key: string;
  name: string;
  whelpYear: number | null;
  sireOccurrences: number;
  damOccurrences: number;
  contributionPct: number;
}

export interface InbreedingAnalysis {
  coiPct: number;
  contributions: InbreedingContribution[];
  /** Either mapped pedigree is materially incomplete — COI is a floor. */
  incomplete: boolean;
  sireCompleteness: PedigreeCompleteness;
  damCompleteness: PedigreeCompleteness;
}

// Below this mapped-pedigree completeness the COI is flagged as understated:
// missing ancestor slots can hide real shared lines.
// ponytail: fixed 75% floor; expose as a param only if product wants to tune it.
const MATERIALLY_INCOMPLETE_PCT = 75;

/**
 * Wright's coefficient of inbreeding for the offspring of `sireTree`'s and
 * `damTree`'s subjects, computed over the loaded generations only.
 *
 * For every ancestor shared by both parents, and every distinct pair of
 * root→ancestor paths (one per side) that meet ONLY at that ancestor:
 *   F += (1/2)^(n1 + n2 + 1)
 * n1/n2 are the two path depths under the parent = 0 convention (a parent is
 * generation 0, its parents generation 1, ...). The ancestor's own inbreeding
 * is ignored — the standard (1 + F_A) factor is treated as 1 — because the
 * loaded data is incomplete; the UI states this caveat.
 */
export function wrightCoefficient(
  sireTree: PedigreeNode,
  damTree: PedigreeNode,
  generations: number,
): InbreedingAnalysis {
  const sirePaths = new Map<string, AncestorPath[]>();
  const damPaths = new Map<string, AncestorPath[]>();
  const meta = new Map<string, AncestorMeta>();
  collectAncestorPaths(sireTree, 0, [], sirePaths, meta);
  collectAncestorPaths(damTree, 0, [], damPaths, meta);

  let f = 0;
  const contributions: InbreedingContribution[] = [];
  for (const [key, sList] of sirePaths) {
    const dList = damPaths.get(key);
    if (!dList) continue;
    let contribution = 0;
    for (const sp of sList) {
      for (const dp of dList) {
        if (!meetsOnlyAt(sp.members, dp.members, key)) continue;
        contribution += 0.5 ** (sp.depth + dp.depth + 1);
      }
    }
    if (contribution <= 0) continue;
    f += contribution;
    const info = meta.get(key)!;
    contributions.push({
      key,
      name: info.name,
      whelpYear: info.whelpYear,
      sireOccurrences: sList.length,
      damOccurrences: dList.length,
      contributionPct: round2(contribution * 100),
    });
  }

  contributions.sort(
    (a, b) => b.contributionPct - a.contributionPct || a.name.localeCompare(b.name),
  );

  const sireCompleteness = pedigreeCompleteness(sireTree, generations);
  const damCompleteness = pedigreeCompleteness(damTree, generations);

  return {
    coiPct: round2(f * 100),
    contributions,
    incomplete:
      sireCompleteness.pct < MATERIALLY_INCOMPLETE_PCT ||
      damCompleteness.pct < MATERIALLY_INCOMPLETE_PCT,
    sireCompleteness,
    damCompleteness,
  };
}

// ---------------------------------------------------------------------------
// Blood quota + ancestor loss over the combined future-litter pedigree.
// Generation is counted FROM THE LITTER: each parent is generation 1, so an
// ancestor at tree-depth d within a parent's pedigree sits at litter-gen d + 1
// and passes (1/2)^(d+1) of its blood down that line. (This is a different
// convention from wrightCoefficient's parent = 0 depths — kept separate on
// purpose so each coefficient reads the way breeders expect.)
// ---------------------------------------------------------------------------

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

type Side = "sire" | "dam";

export interface BloodGenCount {
  gen: number;
  sire: number;
  dam: number;
}

export interface BloodAncestor {
  key: string;
  name: string;
  whelpYear: number | null;
  totalPct: number;
  sirePct: number;
  damPct: number;
  occurrences: number;
  /** Per litter-generation occurrence counts, one entry per gen 1..generations. */
  byGen: BloodGenCount[];
}

export interface AncestorLoss {
  /** 1 − unique/mapped, as a percentage. 0% = every mapped ancestor distinct. */
  lossPct: number;
  uniqueAncestors: number;
  mappedPositions: number;
  generations: number;
}

export interface BloodQuotaAnalysis {
  doubleAncestors: BloodAncestor[];
  ancestorLoss: AncestorLoss;
  generations: number;
}

interface BloodAcc {
  name: string;
  whelpYear: number | null;
  sireBlood: number;
  damBlood: number;
  sireOcc: number;
  damOcc: number;
  gens: Map<number, { sire: number; dam: number }>;
}

// Accumulate blood share + per-generation occurrences for one parent's tree,
// capped at litter-generation `generations` (the parent itself is gen 1).
function walkBlood(
  node: PedigreeNode | undefined,
  depth: number,
  side: Side,
  generations: number,
  acc: Map<string, BloodAcc>,
): void {
  if (!node) return;
  const gen = depth + 1; // litter generation: parent = 1
  if (gen > generations) return;
  const key = nodeKey(node);
  if (key) {
    const entry: BloodAcc =
      acc.get(key) ?? {
        name: node.name,
        whelpYear: node.whelpYear,
        sireBlood: 0,
        damBlood: 0,
        sireOcc: 0,
        damOcc: 0,
        gens: new Map(),
      };
    const blood = 0.5 ** gen;
    const g = entry.gens.get(gen) ?? { sire: 0, dam: 0 };
    if (side === "sire") {
      entry.sireBlood += blood;
      entry.sireOcc += 1;
      g.sire += 1;
    } else {
      entry.damBlood += blood;
      entry.damOcc += 1;
      g.dam += 1;
    }
    entry.gens.set(gen, g);
    acc.set(key, entry);
  }
  walkBlood(node.sire, depth + 1, side, generations, acc);
  walkBlood(node.dam, depth + 1, side, generations, acc);
}

/**
 * "Blood quota of double ancestors" + ancestor loss for the prospective litter.
 *
 * doubleAncestors: every ancestor occupying two or more positions in the
 * combined pedigree (cross-side shared OR line-bred within one parent), with
 * its total blood share, the sire/dam split, and per-generation occurrence
 * counts. Sorted by total blood share, highest first.
 *
 * ancestorLoss: 1 − uniqueAncestors / mappedPositions over the window. Measured
 * against FILLED positions, not the theoretical 2^1+…+2^g slots, so it reports
 * real ancestor duplication rather than penalising incomplete data. 0% means
 * every mapped ancestor is distinct; higher means more duplication.
 */
export function bloodQuota(
  sireTree: PedigreeNode,
  damTree: PedigreeNode,
  generations: number,
): BloodQuotaAnalysis {
  const acc = new Map<string, BloodAcc>();
  walkBlood(sireTree, 0, "sire", generations, acc);
  walkBlood(damTree, 0, "dam", generations, acc);

  let mappedPositions = 0;
  const doubleAncestors: BloodAncestor[] = [];
  for (const [key, e] of acc) {
    const occurrences = e.sireOcc + e.damOcc;
    mappedPositions += occurrences;
    if (occurrences < 2) continue; // "double ancestors" only
    const sirePct = round1(e.sireBlood * 100);
    const damPct = round1(e.damBlood * 100);
    const byGen: BloodGenCount[] = [];
    for (let gen = 1; gen <= generations; gen++) {
      const g = e.gens.get(gen);
      byGen.push({ gen, sire: g?.sire ?? 0, dam: g?.dam ?? 0 });
    }
    doubleAncestors.push({
      key,
      name: e.name,
      whelpYear: e.whelpYear,
      sirePct,
      damPct,
      // Total is the sum of the rounded halves so the split always reconciles.
      totalPct: round1(sirePct + damPct),
      occurrences,
      byGen,
    });
  }

  doubleAncestors.sort(
    (a, b) => b.totalPct - a.totalPct || a.name.localeCompare(b.name),
  );

  const uniqueAncestors = acc.size;
  const lossPct =
    mappedPositions > 0
      ? round1((1 - uniqueAncestors / mappedPositions) * 100)
      : 0;

  return {
    doubleAncestors,
    ancestorLoss: { lossPct, uniqueAncestors, mappedPositions, generations },
    generations,
  };
}
