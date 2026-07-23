import { cache } from "react";

import { prisma, safeQuery } from "@/lib/db";

/**
 * Query-time identity bridging for dogs that exist as multiple `Dog` rows
 * (racing import, GALTD studbook import, legacy unsourced rows). Rows are
 * NEVER merged in the database here — production identity repair stays behind
 * the PedigreeMergeLedger approval workflow. This module only groups rows at
 * read time so search, test mating and pedigrees present one dog per real dog.
 *
 * Merge rule (conservative — wrong fusion is worse than a duplicate):
 * - identical normalized name;
 * - rows from the same non-empty sourceProvider are always distinct dogs
 *   (each provider dedupes internally), so they seed separate clusters;
 * - whelp dates, when both known, must land within one calendar year
 *   (name reuse across eras is real; the whelp date is the discriminator);
 * - a row compatible with more than one existing cluster stays solo
 *   (ambiguity guard) rather than guessing;
 * - sex never blocks a merge: studbook sex labels are known-noisy
 *   (thousands of male-labelled dams), so sex is display-only.
 */

export interface DogIdentityRow {
  id: string;
  name: string;
  sex: string | null;
  colour: string | null;
  whelpDate: Date | null;
  sourceProvider: string | null;
  sireId: string | null;
  damId: string | null;
  careerStarts: number | null;
  careerWins: number | null;
  prizeMoney: number | null;
}

export interface MergedDogIdentity {
  /** Best row to represent the dog (racing record preferred). */
  primaryId: string;
  /** Every Dog row id in the cluster, primary first. */
  ids: string[];
  name: string;
  sex: string | null;
  colour: string | null;
  whelpDate: Date | null;
  /** Effective parent links: first non-null across members by primacy. */
  sireId: string | null;
  damId: string | null;
  careerStarts: number | null;
  careerWins: number | null;
  prizeMoney: number | null;
  memberCount: number;
}

export function normalizeDogName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

const yearOf = (d: Date | null): number | null => (d ? d.getUTCFullYear() : null);

// Racing-record rows outrank studbook-only rows: they carry the stats and the
// ids the rest of the app (runners, form, profiles) already points at.
function primacyScore(row: DogIdentityRow): number {
  let score = 0;
  if (row.careerStarts !== null) score += 4;
  if (row.whelpDate !== null) score += 2;
  if (row.colour !== null) score += 1;
  return score;
}

function whelpCompatible(a: DogIdentityRow, b: DogIdentityRow): boolean {
  const ya = yearOf(a.whelpDate);
  const yb = yearOf(b.whelpDate);
  if (ya === null || yb === null) return true;
  return Math.abs(ya - yb) <= 1;
}

function providerOf(row: DogIdentityRow): string | null {
  return row.sourceProvider && row.sourceProvider.length > 0 ? row.sourceProvider : null;
}

function clusterCompatible(cluster: DogIdentityRow[], row: DogIdentityRow): boolean {
  const rowProvider = providerOf(row);
  for (const member of cluster) {
    if (!whelpCompatible(member, row)) return false;
    const memberProvider = providerOf(member);
    if (rowProvider !== null && memberProvider !== null && rowProvider === memberProvider) {
      return false;
    }
  }
  return true;
}

/**
 * Group same-named rows into identity clusters. Input rows may span multiple
 * names; grouping is per normalized name. Pure — unit tested directly.
 */
export function clusterDogRows(rows: DogIdentityRow[]): DogIdentityRow[][] {
  const byName = new Map<string, DogIdentityRow[]>();
  for (const row of rows) {
    const key = normalizeDogName(row.name);
    const list = byName.get(key);
    if (list) list.push(row);
    else byName.set(key, [row]);
  }

  const clusters: DogIdentityRow[][] = [];
  for (const list of byName.values()) {
    // Provider-anchored rows seed clusters first: each provider dedupes
    // internally, so its rows define the real distinct dogs. Loose rows
    // (no provider) then attach only when exactly one cluster fits.
    const sorted = [...list].sort(
      (a, b) =>
        Number(providerOf(b) !== null) - Number(providerOf(a) !== null) ||
        primacyScore(b) - primacyScore(a),
    );
    const nameClusters: DogIdentityRow[][] = [];
    for (const row of sorted) {
      const compatible = nameClusters.filter((c) => clusterCompatible(c, row));
      if (compatible.length === 1) {
        compatible[0].push(row);
      } else {
        // Zero compatible -> genuinely new dog. Two+ compatible -> ambiguous;
        // keep the row separate rather than risk fusing distinct dogs.
        nameClusters.push([row]);
      }
    }
    clusters.push(...nameClusters);
  }
  return clusters;
}

export function mergeCluster(cluster: DogIdentityRow[]): MergedDogIdentity {
  const members = [...cluster].sort((a, b) => primacyScore(b) - primacyScore(a));
  const primary = members[0];
  const first = <T>(pick: (row: DogIdentityRow) => T | null): T | null => {
    for (const member of members) {
      const value = pick(member);
      if (value !== null && value !== undefined) return value;
    }
    return null;
  };
  return {
    primaryId: primary.id,
    ids: members.map((m) => m.id),
    name: primary.name,
    sex: first((r) => r.sex),
    colour: first((r) => r.colour),
    whelpDate: first((r) => r.whelpDate),
    sireId: first((r) => r.sireId),
    damId: first((r) => r.damId),
    careerStarts: first((r) => r.careerStarts),
    careerWins: first((r) => r.careerWins),
    prizeMoney: first((r) => r.prizeMoney),
    memberCount: members.length,
  };
}

export const DOG_IDENTITY_SELECT = {
  id: true,
  name: true,
  sex: true,
  colour: true,
  whelpDate: true,
  sourceProvider: true,
  sireId: true,
  damId: true,
  careerStarts: true,
  careerWins: true,
  prizeMoney: true,
} as const;

/** Fetch all rows sharing any of the given normalized names. */
export async function fetchRowsByNames(names: string[]): Promise<DogIdentityRow[]> {
  const unique = [...new Set(names.map((n) => normalizeDogName(n)))].filter(Boolean);
  if (unique.length === 0) return [];
  return safeQuery(
    () =>
      prisma.$queryRaw<DogIdentityRow[]>`
        SELECT d.id, d.name, d.sex, d.colour, d."whelpDate", d."sourceProvider",
          d."sireId", d."damId", d."careerStarts", d."careerWins", d."prizeMoney"
        FROM "Dog" d
        WHERE lower(d.name) = ANY(${unique})
        LIMIT 400
      `,
    [],
  );
}

/**
 * Resolve one dog id to its merged identity (row + compatible twins).
 * Returns null when the id does not exist.
 */
export const resolveDogIdentity = cache(
  async (dogId: string): Promise<MergedDogIdentity | null> => {
    const row = await safeQuery(
      () => prisma.dog.findUnique({ where: { id: dogId }, select: DOG_IDENTITY_SELECT }),
      null,
    );
    if (!row) return null;
    const twins = await fetchRowsByNames([row.name]);
    const pool = twins.some((t) => t.id === row.id) ? twins : [...twins, row];
    const clusters = clusterDogRows(pool);
    const own = clusters.find((c) => c.some((member) => member.id === dogId));
    return mergeCluster(own ?? [row]);
  },
);
