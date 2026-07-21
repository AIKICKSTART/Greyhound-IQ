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
