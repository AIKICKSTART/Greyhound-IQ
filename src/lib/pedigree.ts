import { cache } from "react";

import { prisma, safeQuery } from "@/lib/db";
import {
  DOG_IDENTITY_SELECT,
  clusterDogRows,
  fetchRowsByNames,
  mergeCluster,
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

const yearOf = (d: Date | null): number | null => (d ? d.getUTCFullYear() : null);

/**
 * Build a pedigree tree up to `generations` deep from reviewed parent links.
 * Each node is resolved through query-time identity bridging (dog-identity)
 * so a dog split across racing and studbook rows contributes its deepest
 * known parents and its racing record together. Rows only bridge under the
 * conservative cluster rule — ambiguous names stay separate.
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

      const rootNode: PedigreeNode = identityToNode(root);
      let frontier: { node: PedigreeNode; sireId: string | null; damId: string | null }[] = [
        { node: rootNode, sireId: root.sireId, damId: root.damId },
      ];

      for (let gen = 0; gen < boundedGenerations && frontier.length > 0; gen++) {
        const ids = [
          ...new Set(
            frontier.flatMap((f) => [f.sireId, f.damId]).filter((id): id is string => Boolean(id))
          ),
        ];
        if (ids.length === 0) break;

        const rows = await safeQuery(
          () =>
            prisma.dog.findMany({
              where: { id: { in: ids } },
              select: DOG_IDENTITY_SELECT,
              take: 64,
            }),
          [] as DogIdentityRow[],
        );
        if (rows.length === 0) break;

        // Bridge each fetched parent with its same-name twins so studbook-only
        // parents pick up racing stats and deeper links (and vice versa).
        const twins = await fetchRowsByNames(rows.map((r) => r.name));
        const poolById = new Map<string, DogIdentityRow>();
        for (const row of [...rows, ...twins]) poolById.set(row.id, row);
        const mergedByMemberId = new Map<string, MergedDogIdentity>();
        for (const cluster of clusterDogRows([...poolById.values()])) {
          const merged = mergeCluster(cluster);
          for (const member of cluster) mergedByMemberId.set(member.id, merged);
        }

        const next: typeof frontier = [];
        for (const { node, sireId, damId } of frontier) {
          const sire = sireId ? mergedByMemberId.get(sireId) : undefined;
          if (sire) {
            node.sire = identityToNode(sire);
            next.push({ node: node.sire, sireId: sire.sireId, damId: sire.damId });
          }
          const dam = damId ? mergedByMemberId.get(damId) : undefined;
          if (dam) {
            node.dam = identityToNode(dam);
            next.push({ node: node.dam, sireId: dam.sireId, damId: dam.damId });
          }
        }
        frontier = next;
      }

      return rootNode.sire || rootNode.dam ? rootNode : null;
    }, null);
  }
);

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
