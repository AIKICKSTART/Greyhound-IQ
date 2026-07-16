export const ONBOARDING_REVEAL_KINDS = ["tab", "modal"] as const;

export type OnboardingRevealKind = (typeof ONBOARDING_REVEAL_KINDS)[number];

export function resolveOnboardingRevealKind(
  value: string | null | undefined,
): OnboardingRevealKind | null {
  return value === "tab" || value === "modal" ? value : null;
}

export function isAllowedOnboardingRevealController({
  ariaDisabled,
  controls,
  disabled,
  kind,
  role,
  tagName,
  targetId,
  type,
}: {
  ariaDisabled: string | null;
  controls: string | null | undefined;
  disabled: boolean;
  kind: string | null | undefined;
  role: string | null;
  tagName: string;
  targetId: string;
  type: string | null;
}) {
  const revealKind = resolveOnboardingRevealKind(kind);
  if (
    !revealKind ||
    tagName.toUpperCase() !== "BUTTON" ||
    type !== "button" ||
    disabled ||
    ariaDisabled === "true" ||
    !controls?.split(/\s+/).includes(targetId)
  ) {
    return false;
  }

  return revealKind === "modal" || role === "tab";
}
