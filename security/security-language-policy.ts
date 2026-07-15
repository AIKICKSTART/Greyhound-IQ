import { VERIFICATION_STATUSES } from "./shared";

const SECURITY_LANGUAGE_REQUIREMENT_IDS = [
  "security.security-language.no-perfectly-secure",
  "security.security-language.no-100-percent-secure",
  "security.security-language.no-impossible-to-exploit",
  "security.security-language.no-fully-protected-without-evidence",
  "security.security-language.no-hidden-route-security",
  "security.security-language.no-frontend-validation-security",
] as const;

const SECURITY_STATUS_REQUIREMENT_IDS = [
  "security.security-language.status-verified",
  "security.security-language.status-partial",
  "security.security-language.status-not-verified",
  "security.security-language.status-control-missing",
  "security.security-language.status-vulnerable",
  "security.security-language.status-test-missing",
  "security.security-language.status-release-blocked",
  "security.security-language.status-risk-accepted",
  "security.security-language.status-not-applicable",
] as const;

export const SECURITY_LANGUAGE_POLICY_IDS = [
  ...SECURITY_LANGUAGE_REQUIREMENT_IDS,
  ...SECURITY_STATUS_REQUIREMENT_IDS,
] as const;

export const SECURITY_ASSURANCE_PROHIBITIONS = [
  { id: "perfectly-secure", pattern: /\bperfectly secure\b/i },
  { id: "100-percent-secure", pattern: /\b100% secure\b/i },
  { id: "impossible-to-exploit", pattern: /\bimpossible to exploit\b/i },
  { id: "fully-protected", pattern: /\bfully protected\b/i },
  { id: "hidden-route-security", pattern: /\bsecure because (?:it|the route) is hidden\b/i },
  { id: "frontend-validation-security", pattern: /\bsecure because (?:the )?frontend validates\b/i },
] as const;

export function findUnsupportedSecurityAssuranceClaims(text: string) {
  return text
    .split(/\r?\n/)
    .flatMap((line, index) =>
      SECURITY_ASSURANCE_PROHIBITIONS.filter(({ pattern }) => pattern.test(line))
        .filter(() => !/\b(?:do not|must not|never|cannot|not)\b/i.test(line))
        .map(({ id }) => `${index + 1}:${id}`),
    );
}

export function hasCompleteVerificationStatusVocabulary() {
  return (
    VERIFICATION_STATUSES.length === 9 &&
    new Set(VERIFICATION_STATUSES).size === VERIFICATION_STATUSES.length
  );
}
