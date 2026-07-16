export type DesignLabAccessDecision =
  | "allow-local"
  | "allow-isolated-demo"
  | "require-administrator"
  | "deny";

export function resolveDesignLabAccessDecision({
  nodeEnv,
  enabled,
  isolatedDemo,
}: {
  nodeEnv: string | undefined;
  enabled: string | undefined;
  isolatedDemo: boolean;
}): DesignLabAccessDecision {
  if (nodeEnv !== "production") return "allow-local";
  if (enabled !== "true") return "deny";
  if (isolatedDemo) return "allow-isolated-demo";
  return "require-administrator";
}
