import { AGENTS_ONBOARDING_ROUTE_TOURS } from "./agents-onboarding-tour-registry";
import { COMMUNITY_ONBOARDING_ROUTE_TOURS } from "./community-onboarding-tour-registry";
import { DESIGN_LAB_ONBOARDING_ROUTE_TOURS } from "./design-lab-onboarding-tour-registry";
import { MARKETPLACE_ONBOARDING_ROUTE_TOURS } from "./marketplace-onboarding-tour-registry";
import {
  ACCOUNT_ONBOARDING_ROUTE_TOURS,
  ADMIN_ONBOARDING_ROUTE_TOURS,
} from "./onboarding-tour-registry";
import { PUBLIC_ONBOARDING_ROUTE_TOURS } from "./public-onboarding-tour-registry";
import { RACING_ONBOARDING_ROUTE_TOURS } from "./racing-onboarding-tour-registry";

export const ONBOARDING_ANALYTICS_SCHEMA_VERSION = 1 as const;
export const ONBOARDING_ANALYTICS_MAX_BODY_BYTES = 512;
export const ONBOARDING_ANALYTICS_LEGACY_TOUR_ID =
  "tour:getting-started:v1" as const;
export const ONBOARDING_ANALYTICS_LEGACY_STEP_IDS = [
  "getting-started-welcome",
  "getting-started-racing",
  "getting-started-community",
  "getting-started-navigation",
  "getting-started-account",
] as const;

export const ONBOARDING_ANALYTICS_EVENT_NAMES = [
  "tour-started",
  "step-viewed",
  "step-skipped",
  "tour-dismissed",
  "tour-completed",
  "tour-restarted",
  "help-opened",
  "upgrade-viewed",
  "support-selected",
] as const;

export type OnboardingAnalyticsEventName =
  (typeof ONBOARDING_ANALYTICS_EVENT_NAMES)[number];

export type OnboardingAnalyticsEvent = Readonly<{
  schemaVersion: typeof ONBOARDING_ANALYTICS_SCHEMA_VERSION;
  event: OnboardingAnalyticsEventName;
  tourId: string;
  stepId?: string;
}>;

type AnalyticsTour = Readonly<{
  tourId: string;
  steps: readonly Readonly<{ id: string }>[];
}>;

const ANALYTICS_TOURS = [
  ...ADMIN_ONBOARDING_ROUTE_TOURS,
  ...ACCOUNT_ONBOARDING_ROUTE_TOURS,
  ...RACING_ONBOARDING_ROUTE_TOURS,
  ...COMMUNITY_ONBOARDING_ROUTE_TOURS,
  ...PUBLIC_ONBOARDING_ROUTE_TOURS,
  ...MARKETPLACE_ONBOARDING_ROUTE_TOURS,
  ...AGENTS_ONBOARDING_ROUTE_TOURS,
  ...DESIGN_LAB_ONBOARDING_ROUTE_TOURS,
] as readonly AnalyticsTour[];

const STEP_EVENT_NAMES = new Set<OnboardingAnalyticsEventName>([
  "step-viewed",
  "step-skipped",
]);
const ALLOWED_FIELDS = new Set(["schemaVersion", "event", "tourId", "stepId"]);
const EVENT_NAMES = new Set<string>(ONBOARDING_ANALYTICS_EVENT_NAMES);
const STEP_IDS_BY_TOUR = buildStepIdsByTour();

export function parseOnboardingAnalyticsEvent(
  value: unknown,
): OnboardingAnalyticsEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ALLOWED_FIELDS.has(key))) return null;
  if (record.schemaVersion !== ONBOARDING_ANALYTICS_SCHEMA_VERSION) return null;
  if (typeof record.event !== "string" || !EVENT_NAMES.has(record.event)) {
    return null;
  }
  if (typeof record.tourId !== "string" || !STEP_IDS_BY_TOUR.has(record.tourId)) {
    return null;
  }

  const event = record.event as OnboardingAnalyticsEventName;
  const requiresStep = STEP_EVENT_NAMES.has(event);
  if (requiresStep) {
    if (
      typeof record.stepId !== "string" ||
      !STEP_IDS_BY_TOUR.get(record.tourId)?.has(record.stepId)
    ) {
      return null;
    }
  } else if (record.stepId !== undefined) {
    return null;
  }

  return Object.freeze({
    schemaVersion: ONBOARDING_ANALYTICS_SCHEMA_VERSION,
    event,
    tourId: record.tourId,
    ...(requiresStep ? { stepId: record.stepId as string } : {}),
  });
}

export function isKnownOnboardingAnalyticsTour(tourId: string) {
  return STEP_IDS_BY_TOUR.has(tourId);
}

function buildStepIdsByTour() {
  const result = new Map<string, Set<string>>([
    [
      ONBOARDING_ANALYTICS_LEGACY_TOUR_ID,
      new Set<string>(ONBOARDING_ANALYTICS_LEGACY_STEP_IDS),
    ],
  ]);

  for (const tour of ANALYTICS_TOURS) {
    const stepIds = result.get(tour.tourId) ?? new Set<string>();
    for (const step of tour.steps) stepIds.add(step.id);
    result.set(tour.tourId, stepIds);
  }
  return result;
}
