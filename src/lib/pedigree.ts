import { cache } from "react";

import { prisma, safeQuery } from "@/lib/db";

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

interface DogRow {
  id: string;
  name: string;
  sex: string | null;
  colour: string | null;
  whelpDate: Date | null;
  sireId: string | null;
  damId: string | null;
  careerStarts: number | null;
  careerWins: number | null;
  prizeMoney: number | null;
}

const NODE_SELECT = {
  id: true,
  name: true,
  sex: true,
  colour: true,
  whelpDate: true,
  sireId: true,
  damId: true,
  careerStarts: true,
  careerWins: true,
  prizeMoney: true,
} as const;

const MAX_PEDIGREE_GENERATIONS = 5;

const yearOf = (d: Date | null): number | null => (d ? d.getUTCFullYear() : null);

/**
 * Build a pedigree tree up to `generations` deep from reviewed parent links.
 * Name-based bridging is deliberately excluded because greyhound names are not
 * unique; normalization must resolve source identities before this read path.
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
      const root = await prisma.dog.findUnique({ where: { id: rootId }, select: NODE_SELECT });
      if (!root) return null;

      const rootNode: PedigreeNode = toNode(root);
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

        const rows = await prisma.dog.findMany({
          where: { id: { in: ids } },
          select: NODE_SELECT,
          take: 64,
        });
        const byId = new Map(rows.map((r) => [r.id, r]));

        const next: typeof frontier = [];
        for (const { node, sireId, damId } of frontier) {
          if (sireId && byId.has(sireId)) {
            const r = byId.get(sireId)!;
            node.sire = toNode(r);
            next.push({ node: node.sire, sireId: r.sireId, damId: r.damId });
          }
          if (damId && byId.has(damId)) {
            const r = byId.get(damId)!;
            node.dam = toNode(r);
            next.push({ node: node.dam, sireId: r.sireId, damId: r.damId });
          }
        }
        frontier = next;
      }

      return rootNode.sire || rootNode.dam ? rootNode : null;
    }, null);
  }
);

function toNode(row: DogRow): PedigreeNode {
  return {
    id: row.id,
    name: row.name,
    sex: row.sex,
    colour: row.colour,
    whelpYear: yearOf(row.whelpDate),
    careerStarts: row.careerStarts,
    careerWins: row.careerWins,
    prizeMoney: row.prizeMoney,
  };
}
