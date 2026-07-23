export const ONBOARDING_PERSONAS = ["trainer", "support-operator"] as const;

export type OnboardingPersona = (typeof ONBOARDING_PERSONAS)[number];

export const SUPPORT_OPERATOR_ONBOARDING_ROUTES = [
  "/admin/support",
  "/admin/feedback",
  "/admin/bug-reports",
] as const;

const SUPPORT_OPERATOR_ROUTE_SET = new Set<string>(
  SUPPORT_OPERATOR_ONBOARDING_ROUTES,
);

export function isSupportOperatorOnboardingRoute(
  route: string | null | undefined,
) {
  if (!route) return false;
  const normalized = route.length > 1 ? route.replace(/\/$/, "") : route;
  return SUPPORT_OPERATOR_ROUTE_SET.has(normalized);
}
