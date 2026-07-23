import "server-only";

import type { Tier } from "@/lib/tier-access";
import { assertProPlusFeatureAccess } from "@/lib/tier-access";

export const TIPS_PREVIEW_MODEL = {
  status: "preview_only",
  live: false,
  metrics: [
    { label: "Races assessed", value: "—" },
    { label: "High confidence", value: "—" },
    { label: "Results tracked", value: "—" },
  ],
  agentRoles: [
    {
      name: "Form Reader",
      detail: "Reviews recent form, class and consistency.",
      tone: "silver",
    },
    {
      name: "Clocker",
      detail: "Studies speed, sectionals and race shape.",
      tone: "purple",
    },
    {
      name: "Market Watcher",
      detail: "Compares the model with market movement.",
      tone: "gold",
    },
  ],
} as const;

export function getTipsPreview(current: { tier: Tier }) {
  assertProPlusFeatureAccess(current);
  return TIPS_PREVIEW_MODEL;
}
