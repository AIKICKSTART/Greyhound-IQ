import { cache } from "react";

import { prisma, safeQuery } from "@/lib/db";
import {
  DOG_IDENTITY_SELECT,
  clusterDogRows,
  fetchRowsByNames,
  mergeCluster,
  normalizeDogName,
  resolveDogIdentity,
  type DogIdentityRow,
  type MergedDogIdentity,
} from "@/lib/dog-identity";

export interface PedigreeNode {
  id: string | null;
  name: string;
  sex: string | null;
  colour: string | null;
  whelpYear: number | null;
  // Real racing record where available. Missing values stay null (never 0) so
  // the chart can omit them rather than imply an unraced dog scored nothing.
  careerStarts: number | null;
  careerWins: number | null;
  prizeMoney: number | null;
  sire?: PedigreeNode;
  dam?: PedigreeNode;
}

const MAX_PEDIGREE_GENERATIONS = 5;
const USABLE_ASSERTION_STATUSES = ["parsed", "verified"];

const yearOf = (d: Date | null): number | null => (d ? d.getUTCFullYear() : null);

/** How the walk reaches a parent that is not yet a materialized Dog link. */
type ParentRef =
  | { kind: "dog"; id: string }
  | { kind: "name"; name: string; whelpYear: number | null };

interface FrontierEntry {
  node: PedigreeNode;
  sire: ParentRef | null;
  dam: ParentRef | null;
  /** Dog row ids backing this node, for the assertion fallback lookup. */
  clusterIds?: string[];
}

interface AssertionParent {
  relationship: string;
  assertedParentName: string;
  parentDogId: string | null;
  parentWhelpYear: number | null;
}

// Studbook parent assertions for dogs in `dogIds` whose Dog rows never got the
// link materialized (the PedigreeMergeLedger approval step is still pending for
// ~144k of them). Read-only: nothing here writes links back.
async function fetchAssertionsByDogIds(
  dogIds: string[],
): Promise<Map<string, AssertionParent[]>> {
  if (dogIds.length === 0) return new Map();
  const rows = await safeQuery(
    () =>
      prisma.pedigreeAssertion.findMany({
        where: {
          verificationStatus: { in: USABLE_ASSERTION_STATUSES },
          subjectIdentity: { dogId: { in: dogIds } },
        },
        select: {
          relationship: true,
          assertedParentName: true,
          subjectIdentity: { select: { dogId: true } },
          parentIdentity: { select: { dogId: true, observedWhelpDate: true } },
        },
        take: 600,
      }),
    [],
  );
  const byDog = new Map<string, AssertionParent[]>();
  for (const row of rows) {
    const dogId = row.subjectIdentity.dogId;
    if (!dogId) continue;
    const list = byDog.get(dogId) ?? [];
    list.push({
      relationship: row.relationship,
      assertedParentName: row.assertedParentName,
      parentDogId: row.parentIdentity?.dogId ?? null,
      parentWhelpYear: yearOf(row.parentIdentity?.observedWhelpDate ?? null),
    });
    byDog.set(dogId, list);
  }
  return byDog;
}

// Parent assertions where the SUBJECT itself has no Dog row yet — reached by
// the subject's studbook name. Lets an assertion-only ancestor still carry its
// own recorded parents one hop deeper.
async function fetchAssertionsBySubjectNames(
  names: string[],
): Promise<Map<string, AssertionParent[]>> {
  const unique = [...new Set(names.map(normalizeDogName))].filter(Boolean);
  if (unique.length === 0) return new Map();
  const rows = await safeQuery(
    () =>
      prisma.pedigreeAssertion.findMany({
        where: {
          verificationStatus: { in: USABLE_ASSERTION_STATUSES },
          subjectIdentity: { normalizedName: { in: unique } },
        },
        select: {
          relationship: true,
          assertedParentName: true,
          subjectIdentity: { select: { normalizedName: true } },
          parentIdentity: { select: { dogId: true, observedWhelpDate: true } },
        },
        take: 600,
      }),
    [],
  );
  const byName = new Map<string, AssertionParent[]>();
  for (const row of rows) {
    const key = row.subjectIdentity.normalizedName;
    const list = byName.get(key) ?? [];
    list.push({
      relationship: row.relationship,
      assertedParentName: row.assertedParentName,
      parentDogId: row.parentIdentity?.dogId ?? null,
      parentWhelpYear: yearOf(row.parentIdentity?.observedWhelpDate ?? null),
    });
    byName.set(key, list);
  }
  return byName;
}

function refFromAssertion(assertion: AssertionParent): ParentRef {
  if (assertion.parentDogId) return { kind: "dog", id: assertion.parentDogId };
  return {
    kind: "name",
    name: assertion.assertedParentName,
    whelpYear: assertion.parentWhelpYear,
  };
}

// Fill a node's missing parent refs from its cluster's studbook assertions.
function applyAssertionFallback(
  entry: FrontierEntry,
  clusterIds: string[],
  assertionsByDog: Map<string, AssertionParent[]>,
): void {
  for (const id of clusterIds) {
    for (const assertion of assertionsByDog.get(id) ?? []) {
      if (entry.sire === null && assertion.relationship === "sire") {
        entry.sire = refFromAssertion(assertion);
      } else if (entry.dam === null && assertion.relationship === "dam") {
        entry.dam = refFromAssertion(assertion);
      }
    }
  }
}

function identityToNode(identity: MergedDogIdentity): PedigreeNode {
  return {
    id: identity.primaryId,
    name: identity.name,
    sex: identity.sex,
    colour: identity.colour,
    whelpYear: yearOf(identity.whelpDate),
    careerStarts: identity.careerStarts,
    careerWins: identity.careerWins,
    prizeMoney: identity.prizeMoney,
  };
}

/**
 * Build a pedigree tree up to `generations` deep. Three data layers combine at
 * read time, most reliable first:
 * 1. materialized Dog.sireId/damId links, bridged across split identities;
 * 2. studbook PedigreeAssertion records whose links were never materialized —
 *    resolved to Dog rows via the parent identity or the conservative
 *    name-cluster rule (whelp-hinted, ambiguous names stay unresolved);
 * 3. assertion-only ancestors with no Dog row, rendered as name-only nodes so
 *    the recorded lineage still shows and counts toward completeness.
 * Nothing is written back; durable identity repair stays ledger-gated.
 */
export const getDogPedigree = cache(
  async (rootId: string, generations = 5): Promise<PedigreeNode | null> => {
    return safeQuery(async () => {
      const requestedGenerations = Number.isFinite(generations)
        ? Math.trunc(generations)
        : MAX_PEDIGREE_GENERATIONS;
      const boundedGenerations = Math.min(
        MAX_PEDIGREE_GENERATIONS,
        Math.max(0, requestedGenerations),
      );
      const root = await resolveDogIdentity(rootId);
      if (!root) return null;

      const rootNode = identityToNode(root);
      const rootEntry: FrontierEntry = {
        node: rootNode,
        sire: root.sireId ? { kind: "dog", id: root.sireId } : null,
        dam: root.damId ? { kind: "dog", id: root.damId } : null,
      };
      if (!rootEntry.sire || !rootEntry.dam) {
        const rootAssertions = await fetchAssertionsByDogIds(root.ids);
        applyAssertionFallback(rootEntry, root.ids, rootAssertions);
      }

      let frontier: FrontierEntry[] = [rootEntry];

      for (let gen = 0; gen < boundedGenerations && frontier.length > 0; gen++) {
        const refs = frontier
          .flatMap((entry) => [entry.sire, entry.dam])
          .filter((ref): ref is ParentRef => ref !== null);
        if (refs.length === 0) break;

        const dogIds = [
          ...new Set(refs.filter((r) => r.kind === "dog").map((r) => (r as { id: string }).id)),
        ];
        const nameRefs = refs.filter((r): r is Extract<ParentRef, { kind: "name" }> => r.kind === "name");

        // Layer 1: materialized rows plus their same-name twins.
        const rows =
          dogIds.length > 0
            ? await safeQuery(
                () =>
                  prisma.dog.findMany({
                    where: { id: { in: dogIds } },
                    select: DOG_IDENTITY_SELECT,
                    take: 64,
                  }),
                [] as DogIdentityRow[],
              )
            : [];
        const twinNames = [
          ...new Set([...rows.map((r) => r.name), ...nameRefs.map((r) => r.name)]),
        ];
        const twins = await fetchRowsByNames(twinNames);
        const poolById = new Map<string, DogIdentityRow>();
        for (const row of [...rows, ...twins]) poolById.set(row.id, row);
        const clusters = clusterDogRows([...poolById.values()]);
        const mergedByMemberId = new Map<string, { merged: MergedDogIdentity; ids: string[] }>();
        const clustersByName = new Map<string, { merged: MergedDogIdentity; ids: string[] }[]>();
        for (const cluster of clusters) {
          const merged = mergeCluster(cluster);
          const ids = cluster.map((m) => m.id);
          for (const member of cluster) mergedByMemberId.set(member.id, { merged, ids });
          const key = normalizeDogName(merged.name);
          const list = clustersByName.get(key) ?? [];
          list.push({ merged, ids });
          clustersByName.set(key, list);
        }

        // Resolve every ref to either a dog-backed identity or a name-only node.
        const next: FrontierEntry[] = [];
        const syntheticNames: string[] = [];
        const pendingSynthetic: { entry: FrontierEntry; side: "sire" | "dam"; ref: Extract<ParentRef, { kind: "name" }> }[] = [];

        const resolveRef = (
          ref: ParentRef,
        ): { merged: MergedDogIdentity; ids: string[] } | null => {
          if (ref.kind === "dog") return mergedByMemberId.get(ref.id) ?? null;
          const candidates = clustersByName.get(normalizeDogName(ref.name)) ?? [];
          const compatible =
            ref.whelpYear === null
              ? candidates
              : candidates.filter((c) => {
                  const year = yearOf(c.merged.whelpDate);
                  return year === null || Math.abs(year - ref.whelpYear!) <= 1;
                });
          // Exactly one plausible dog row cluster: safe to attach. Anything
          // else stays a name-only node rather than guessing between dogs.
          return compatible.length === 1 ? compatible[0] : null;
        };

        for (const entry of frontier) {
          for (const side of ["sire", "dam"] as const) {
            const ref = entry[side];
            if (!ref) continue;
            const resolved = resolveRef(ref);
            if (resolved) {
              const childNode = identityToNode(resolved.merged);
              entry.node[side] = childNode;
              next.push({
                node: childNode,
                sire: resolved.merged.sireId ? { kind: "dog", id: resolved.merged.sireId } : null,
                dam: resolved.merged.damId ? { kind: "dog", id: resolved.merged.damId } : null,
                clusterIds: resolved.ids,
              });
            } else if (ref.kind === "name") {
              const childNode: PedigreeNode = {
                id: null,
                name: ref.name,
                sex: side === "sire" ? "M" : "F",
                colour: null,
                whelpYear: ref.whelpYear,
                careerStarts: null,
                careerWins: null,
                prizeMoney: null,
              };
              entry.node[side] = childNode;
              const syntheticEntry: FrontierEntry = { node: childNode, sire: null, dam: null };
              next.push(syntheticEntry);
              syntheticNames.push(ref.name);
              pendingSynthetic.push({ entry: syntheticEntry, side, ref });
            }
          }
        }

        // Layer 2: assertion fallback for dog-backed nodes missing a link.
        const fallbackIds = next
          .filter((e) => (e.sire === null || e.dam === null) && e.clusterIds)
          .flatMap((e) => e.clusterIds ?? []);
        if (fallbackIds.length > 0) {
          const assertionsByDog = await fetchAssertionsByDogIds([...new Set(fallbackIds)]);
          for (const e of next) {
            if (e.clusterIds && (e.sire === null || e.dam === null)) {
              applyAssertionFallback(e, e.clusterIds, assertionsByDog);
            }
          }
        }

        // Layer 3: name-only nodes may still be studbook subjects — pull their
        // own recorded parents so the line continues.
        if (syntheticNames.length > 0) {
          const assertionsByName = await fetchAssertionsBySubjectNames(syntheticNames);
          for (const pending of pendingSynthetic) {
            const list = assertionsByName.get(normalizeDogName(pending.ref.name)) ?? [];
            for (const assertion of list) {
              if (pending.entry.sire === null && assertion.relationship === "sire") {
                pending.entry.sire = refFromAssertion(assertion);
              } else if (pending.entry.dam === null && assertion.relationship === "dam") {
                pending.entry.dam = refFromAssertion(assertion);
              }
            }
          }
        }

        frontier = next;
      }

      return rootNode.sire || rootNode.dam ? rootNode : null;
    }, null);
  }
);
