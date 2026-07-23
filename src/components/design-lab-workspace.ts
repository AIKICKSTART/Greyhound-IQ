export const DESIGN_LAB_AREAS = [
  {
    id: "overview",
    label: "Overview",
    eyebrow: "Mission status",
    description:
      "Release posture, canonical coverage and the most important open gates.",
  },
  {
    id: "delivery",
    label: "Delivery",
    eyebrow: "Team orchestration",
    description:
      "Agent workstreams, evidence, next actions and the canonical section ledger.",
  },
  {
    id: "architecture",
    label: "Architecture",
    eyebrow: "Production design",
    description:
      "The current capacity, security, resilience and disaster-recovery architecture plan.",
  },
  {
    id: "advertising",
    label: "Advertising",
    eyebrow: "Commercial product",
    description:
      "Premium Feed inventory, advertiser controls, pricing and Marketplace boosts.",
  },
  {
    id: "requirements",
    label: "Final to-do",
    eyebrow: "Production completion",
    description:
      "The live, evidence-backed list of every remaining screen, product, security, pre-production and database task.",
  },
  {
    id: "readiness",
    label: "Readiness",
    eyebrow: "Pre-production",
    description:
      "Provider, database and release-promotion controls required before launch.",
  },
  {
    id: "screens",
    label: "Screen library",
    eyebrow: "Experience inventory",
    description:
      "Search every registered route across each family and end-to-end journey.",
  },
] as const;

export type DesignLabAreaId = (typeof DESIGN_LAB_AREAS)[number]["id"];

export function resolveDesignLabArea(
  value: string | string[] | undefined,
  fallback: DesignLabAreaId = "overview",
): DesignLabAreaId {
  const candidate = Array.isArray(value) ? value[0] : value;
  return DESIGN_LAB_AREAS.some((area) => area.id === candidate)
    ? (candidate as DesignLabAreaId)
    : fallback;
}

export function designLabAreaHref(basePath: string, area: DesignLabAreaId) {
  return `${basePath}?area=${area}`;
}
