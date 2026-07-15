import {
  ONBOARDING_ANALYTICS_MAX_BODY_BYTES,
  parseOnboardingAnalyticsEvent,
  type OnboardingAnalyticsEvent,
} from "./onboarding-analytics";

export const ONBOARDING_ANALYTICS_ENDPOINT = "/api/analytics/onboarding";
export const ONBOARDING_ANALYTICS_CONSENT_STORAGE_KEY =
  "greyhoundiq.cookie-consent.v1";
export const ONBOARDING_ANALYTICS_CONSENT_HEADER =
  "x-greyhoundiq-analytics-consent";

export type OnboardingAnalyticsQueueStatus =
  | "queued"
  | "consent-required"
  | "invalid"
  | "unavailable";

type AnalyticsClientDependencies = Readonly<{
  readConsent?: () => string | null;
  send?: (body: string) => unknown;
}>;

export function queueOnboardingAnalyticsEvent(
  input: OnboardingAnalyticsEvent,
  dependencies: AnalyticsClientDependencies = {},
): OnboardingAnalyticsQueueStatus {
  const event = parseOnboardingAnalyticsEvent(input);
  if (!event) return "invalid";

  const readConsent = dependencies.readConsent ?? readAnalyticsConsent;
  if (readConsent() !== "accepted") return "consent-required";

  const body = JSON.stringify(event);
  if (new TextEncoder().encode(body).byteLength > ONBOARDING_ANALYTICS_MAX_BODY_BYTES) {
    return "invalid";
  }

  try {
    const delivery = (dependencies.send ?? sendOnboardingAnalytics)(body);
    if (delivery && typeof (delivery as PromiseLike<unknown>).then === "function") {
      void Promise.resolve(delivery).catch(() => undefined);
    }
    return "queued";
  } catch {
    return "unavailable";
  }
}

function readAnalyticsConsent() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ONBOARDING_ANALYTICS_CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function sendOnboardingAnalytics(body: string) {
  if (typeof window === "undefined") return;
  return window.fetch(ONBOARDING_ANALYTICS_ENDPOINT, {
    method: "POST",
    body,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      [ONBOARDING_ANALYTICS_CONSENT_HEADER]: "accepted",
    },
    keepalive: true,
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
}
