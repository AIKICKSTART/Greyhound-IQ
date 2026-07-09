import { cache } from "react";

import { prisma, safeQuery } from "@/lib/db";

export interface PedigreeNode {
  id: string | null;
  name: string;
  sex: string | null;
  colour: string | null;
  whelpYear: number | null;
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
}

const NODE_SELECT = {
  id: true,
  name: true,
  sex: true,
  colour: true,
  whelpDate: true,
  sireId: true,
  damId: true,
} as const;

const yearOf = (d: Date | null): number | null => (d ? d.getUTCFullYear() : null);

/**
 * Existing dogs (thedogs / null-provider) carry at most immediate sire/dam. The deep
 * ancestry lives in the `galtd` studbook graph, keyed by name. Bridge to the galtd twin
 * by name (+ whelp year when known) so a shallow record inherits the deep pedigree.
 */
async function galtdTwin(name: string, whelpDate: Date | null): Promise<DogRow | null> {
  const year = yearOf(whelpDate);
  const candidates = await prisma.dog.findMany({
    where: {
      sourceProvider: "galtd",
      name: { equals: name, mode: "insensitive" },
      OR: [{ sireId: { not: null } }, { damId: { not: null } }],
    },
    select: NODE_SELECT,
    take: 8,
  });
  if (candidates.length === 0) return null;
  if (year) {
    const byYear = candidates.find((c) => yearOf(c.whelpDate) === year);
    if (byYear) return byYear;
  }
  return candidates[0];
}

/**
 * Build a pedigree tree up to `generations` deep. Bridges the root into the galtd graph,
 * then loads ancestors breadth-first (one query per generation, not one per node).
 */
export const getDogPedigree = cache(
  async (rootId: string, generations = 5): Promise<PedigreeNode | null> => {
    return safeQuery(async () => {
      const root = await prisma.dog.findUnique({ where: { id: rootId }, select: NODE_SELECT });
      if (!root) return null;

      // Anchor into the deepest available graph. Prefer a linked galtd twin.
      let anchor = root;
      if (!root.sireId && !root.damId) {
        const twin = await galtdTwin(root.name, root.whelpDate);
        if (twin) anchor = twin;
      }

      const rootNode: PedigreeNode = toNode(anchor, root.name);
      let frontier: { node: PedigreeNode; sireId: string | null; damId: string | null }[] = [
        { node: rootNode, sireId: anchor.sireId, damId: anchor.damId },
      ];

      for (let gen = 0; gen < generations && frontier.length > 0; gen++) {
        const ids = [
          ...new Set(
            frontier.flatMap((f) => [f.sireId, f.damId]).filter((id): id is string => Boolean(id))
          ),
        ];
        if (ids.length === 0) break;

        const rows = await prisma.dog.findMany({ where: { id: { in: ids } }, select: NODE_SELECT });
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

function toNode(row: DogRow, displayName?: string): PedigreeNode {
  return {
    id: row.id,
    name: displayName ?? row.name,
    sex: row.sex,
    colour: row.colour,
    whelpYear: yearOf(row.whelpDate),
  };
}
