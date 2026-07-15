import type { BillingTier } from "@/lib/billing/entitlements";

export const AGENT_PRODUCT_CATALOGUE = [
  {
    type: "race_analyst",
    name: "Race Analyst",
    minimumTier: "pro",
    capability:
      "Ranks up to three runners from the next available race using recent finishing positions, recent wins, box draw, and available trainer identity.",
    limitation:
      "The local harness reads the next upcoming race; it does not yet resolve a prompt to a specific meeting or calculate sectionals, track bias, trainer strike rate, confidence, or true probabilities.",
  },
  {
    type: "breeding_advisor",
    name: "Breeding Advisor",
    minimumTier: "pro_plus",
    capability:
      "Matches two named dogs and reports whether their loaded pedigree records share a sire or dam.",
    limitation:
      "This is a shared-parent signal only. It is not a full coefficient-of-inbreeding calculation, genetic test, veterinary risk assessment, or earnings projection.",
  },
  {
    type: "form_reader",
    name: "Form Reader",
    minimumTier: "pro",
    capability:
      "Summarises up to five loaded recent starts and labels the simple finishing-position pattern as improving, mixed, or flat.",
    limitation:
      "It does not model box manners, sectionals, mid-race pace, or track bias, and an unmatched dog returns no match instead of substituting another dog.",
  },
] as const satisfies readonly {
  type: string;
  name: string;
  minimumTier: BillingTier;
  capability: string;
  limitation: string;
}[];

export type AgentType = (typeof AGENT_PRODUCT_CATALOGUE)[number]["type"];

export const AGENT_MINIMUM_TIER = {
  race_analyst: "pro",
  breeding_advisor: "pro_plus",
  form_reader: "pro",
} as const satisfies Readonly<Record<AgentType, BillingTier>>;

export const AGENT_OUTPUT_DISCLAIMER =
  "AI outputs use available GreyhoundIQ data and simple local heuristics. They may be incomplete or stale, are not guarantees, and must be checked against official race and veterinary information before important decisions.";

export function agentTierLabel(tier: BillingTier) {
  if (tier === "pro_plus") return "Pro+";
  if (tier === "pro") return "Pro";
  return "Free";
}
