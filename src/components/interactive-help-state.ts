export const INTERACTIVE_HELP_STORAGE_KEY = "greyhoundiq.interactive-help.v1";
export const INTERACTIVE_HELP_EVENT = "greyhoundiq:interactive-help";
export const INTERACTIVE_HELP_PROGRESS_EVENT =
  "greyhoundiq:interactive-help-progress";
export const INTERACTIVE_HELP_PROGRESS_STORAGE_PREFIX =
  "greyhoundiq.interactive-help.progress";
export const INTERACTIVE_HELP_PROGRESS_CONTEXT_VERSION = "context-v2";
export const INTERACTIVE_HELP_INTENT_EVENT =
  "greyhoundiq:interactive-help-intent";
export const INTERACTIVE_HELP_INTENT_STORAGE_PREFIX =
  "greyhoundiq.interactive-help.intent";

export const INTERACTIVE_HELP_INTENTS = [
  "racing",
  "marketplace",
  "community",
  "account",
  "agents",
] as const;

export type InteractiveHelpIntent = (typeof INTERACTIVE_HELP_INTENTS)[number];

export type InteractiveHelpProgressStorageDescriptor = {
  productArea: string | null;
  profileScope: string;
  role: string | null;
  route: string;
  tier: string | null;
  tourId: string;
  version: number;
};

export const INTERACTIVE_HELP_PRODUCT_AREAS = [
  "account",
  "administration",
  "agents",
  "community",
  "design-lab",
  "marketplace",
  "public",
  "racing",
] as const;

export type InteractiveHelpProductArea =
  (typeof INTERACTIVE_HELP_PRODUCT_AREAS)[number];

export type InteractiveHelpState = {
  completed: boolean;
  enabled: boolean;
};

export type InteractiveHelpAction =
  | "complete"
  | "disable"
  | "enable"
  | "restart";

export const DEFAULT_INTERACTIVE_HELP_STATE: InteractiveHelpState = {
  completed: false,
  enabled: true,
};

export function parseInteractiveHelpState(
  value: string | null | undefined
): InteractiveHelpState {
  if (!value) return DEFAULT_INTERACTIVE_HELP_STATE;

  try {
    const parsed = JSON.parse(value) as Partial<InteractiveHelpState>;
    if (
      typeof parsed.completed !== "boolean" ||
      typeof parsed.enabled !== "boolean"
    ) {
      return DEFAULT_INTERACTIVE_HELP_STATE;
    }
    return { completed: parsed.completed, enabled: parsed.enabled };
  } catch {
    return DEFAULT_INTERACTIVE_HELP_STATE;
  }
}

export function reduceInteractiveHelpState(
  state: InteractiveHelpState,
  action: InteractiveHelpAction
): InteractiveHelpState {
  switch (action) {
    case "complete":
      return { ...state, completed: true };
    case "disable":
      return { completed: true, enabled: false };
    case "enable":
    case "restart":
      return { completed: false, enabled: true };
  }
}

export function serializeInteractiveHelpState(state: InteractiveHelpState) {
  return JSON.stringify(state);
}

export type InteractiveHelpProgressState = {
  completed: boolean;
  completedAt: number | null;
  dismissed: boolean;
  enabled: boolean;
  step: number;
};

export type InteractiveHelpProgressAction =
  | "disable"
  | "dismiss"
  | "enable"
  | "restart"
  | "resume"
  | "next"
  | "back"
  | { type: "complete"; completedAt: number }
  | { type: "set-step"; step: number };

export const DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE: InteractiveHelpProgressState = {
  completed: false,
  completedAt: null,
  dismissed: false,
  enabled: true,
  step: 0,
};

export type RecentlyCompletedInteractiveHelpTour =
  InteractiveHelpProgressStorageDescriptor & {
    completedAt: number;
    storageKey: string;
  };

export function buildInteractiveHelpProgressStorageKey({
  productArea,
  profileScope,
  role,
  route,
  tier,
  tourId,
  version,
}: {
  productArea: string;
  profileScope?: string | null;
  role: string;
  route: string;
  tier: string;
  tourId: string;
  version: number;
}) {
  const scope = profileScope?.trim() || "browser";
  return [
    INTERACTIVE_HELP_PROGRESS_STORAGE_PREFIX,
    INTERACTIVE_HELP_PROGRESS_CONTEXT_VERSION,
    encodeURIComponent(scope),
    encodeURIComponent(normalizeContextIdentifier(productArea, "general")),
    encodeURIComponent(normalizeContextIdentifier(role, "visitor")),
    encodeURIComponent(normalizeContextIdentifier(tier, "free")),
    encodeURIComponent(tourId),
    `v${version}`,
    encodeURIComponent(route),
  ].join(":");
}

export function buildLegacyInteractiveHelpProgressStorageKey({
  profileScope,
  route,
  tourId,
  version,
}: {
  profileScope?: string | null;
  route: string;
  tourId: string;
  version: number;
}) {
  const scope = profileScope?.trim() || "browser";
  return [
    INTERACTIVE_HELP_PROGRESS_STORAGE_PREFIX,
    encodeURIComponent(scope),
    encodeURIComponent(tourId),
    `v${version}`,
    encodeURIComponent(route),
  ].join(":");
}

export function resolveInteractiveHelpProductArea(
  tourId: string,
): InteractiveHelpProductArea | "general" {
  const areaByTourPrefix = [
    ["tour:account:", "account"],
    ["tour:administrator:", "administration"],
    ["tour:moderator:", "administration"],
    ["tour:agents:", "agents"],
    ["tour:community-pulse:", "community"],
    ["tour:design-lab:", "design-lab"],
    ["tour:marketplace:", "marketplace"],
    ["tour:public-foundations:", "public"],
    ["tour:racing-intelligence:", "racing"],
  ] as const;
  return (
    areaByTourPrefix.find(([prefix]) => tourId.startsWith(prefix))?.[1] ??
    "general"
  );
}

export function buildInteractiveHelpIntentStorageKey(
  profileScope: string | null | undefined,
) {
  const scope = profileScope?.trim() || "browser";
  return `${INTERACTIVE_HELP_INTENT_STORAGE_PREFIX}:${encodeURIComponent(scope)}`;
}

export function parseInteractiveHelpIntent(
  value: string | null | undefined,
): InteractiveHelpIntent | null {
  return INTERACTIVE_HELP_INTENTS.find((intent) => intent === value) ?? null;
}

export function parseInteractiveHelpProgressStorageKey(
  storageKey: string,
): InteractiveHelpProgressStorageDescriptor | null {
  const prefix = `${INTERACTIVE_HELP_PROGRESS_STORAGE_PREFIX}:`;
  if (!storageKey.startsWith(prefix)) return null;

  const parts = storageKey.slice(prefix.length).split(":");
  const contextual = parts[0] === INTERACTIVE_HELP_PROGRESS_CONTEXT_VERSION;
  const [
    encodedScope,
    encodedProductArea,
    encodedRole,
    encodedTier,
    encodedTourId,
    versionToken,
    encodedRoute,
    ...extra
  ] = contextual
    ? parts.slice(1)
    : [parts[0], null, null, null, ...parts.slice(1)];
  const versionMatch = /^v([1-9]\d*)$/.exec(versionToken ?? "");
  if (
    !encodedScope ||
    !encodedTourId ||
    !encodedRoute ||
    (contextual && (!encodedProductArea || !encodedRole || !encodedTier)) ||
    extra.length > 0 ||
    !versionMatch
  ) {
    return null;
  }

  try {
    const profileScope = decodeURIComponent(encodedScope);
    const productArea = encodedProductArea
      ? decodeURIComponent(encodedProductArea)
      : null;
    const role = encodedRole ? decodeURIComponent(encodedRole) : null;
    const route = decodeURIComponent(encodedRoute);
    const tier = encodedTier ? decodeURIComponent(encodedTier) : null;
    const tourId = decodeURIComponent(encodedTourId);
    if (
      !profileScope ||
      !route.startsWith("/") ||
      !tourId.startsWith("tour:") ||
      (contextual && (!productArea || !role || !tier))
    ) {
      return null;
    }
    return {
      productArea,
      profileScope,
      role,
      route,
      tier,
      tourId,
      version: Number(versionMatch[1]),
    };
  } catch {
    return null;
  }
}

export function parseInteractiveHelpProgressState(
  value: string | null | undefined,
): InteractiveHelpProgressState {
  if (!value) return DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE;

  try {
    const parsed = JSON.parse(value) as Partial<InteractiveHelpProgressState>;
    if (
      typeof parsed.completed !== "boolean" ||
      typeof parsed.dismissed !== "boolean" ||
      typeof parsed.enabled !== "boolean" ||
      !Number.isSafeInteger(parsed.step) ||
      (parsed.step ?? -1) < 0
    ) {
      return DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE;
    }
    return {
      completed: parsed.completed,
      completedAt: validCompletionTime(parsed.completedAt),
      dismissed: parsed.dismissed,
      enabled: parsed.enabled,
      step: parsed.step!,
    };
  } catch {
    return DEFAULT_INTERACTIVE_HELP_PROGRESS_STATE;
  }
}

export function reduceInteractiveHelpProgressState(
  state: InteractiveHelpProgressState,
  action: InteractiveHelpProgressAction,
): InteractiveHelpProgressState {
  if (typeof action === "object") {
    if (action.type === "complete") {
      return {
        ...state,
        completed: true,
        completedAt: validCompletionTime(action.completedAt),
        dismissed: false,
      };
    }
    return {
      ...state,
      dismissed: false,
      step: Number.isSafeInteger(action.step) ? Math.max(0, action.step) : state.step,
    };
  }

  switch (action) {
    case "disable":
      return { ...state, completed: true, dismissed: false, enabled: false };
    case "dismiss":
      return { ...state, dismissed: true };
    case "enable":
      return {
        ...state,
        completed: false,
        completedAt: null,
        dismissed: false,
        enabled: true,
      };
    case "restart":
      return {
        completed: false,
        completedAt: null,
        dismissed: false,
        enabled: true,
        step: 0,
      };
    case "resume":
      return { ...state, dismissed: false, enabled: true };
    case "next":
      return { ...state, dismissed: false, step: state.step + 1 };
    case "back":
      return { ...state, dismissed: false, step: Math.max(0, state.step - 1) };
  }
}

export function serializeInteractiveHelpProgressState(
  state: InteractiveHelpProgressState,
) {
  return JSON.stringify(state);
}

export function listRecentlyCompletedInteractiveHelpTours(
  entries: Iterable<readonly [string, string]>,
  profileScope: string | null | undefined,
  limit = 5,
) {
  const requestedScope = profileScope?.trim() || "browser";
  const completed: RecentlyCompletedInteractiveHelpTour[] = [];

  for (const [storageKey, value] of entries) {
    const descriptor = parseInteractiveHelpProgressStorageKey(storageKey);
    if (!descriptor || descriptor.profileScope !== requestedScope) continue;
    const progress = parseInteractiveHelpProgressState(value);
    if (!progress.completed || progress.completedAt === null) continue;
    completed.push({ ...descriptor, completedAt: progress.completedAt, storageKey });
  }

  const boundedLimit = Number.isSafeInteger(limit) ? Math.max(0, limit) : 5;
  return completed
    .toSorted(
      (left, right) =>
        right.completedAt - left.completedAt || left.route.localeCompare(right.route),
    )
    .slice(0, boundedLimit);
}

function validCompletionTime(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 8_640_000_000_000_000
    ? value
    : null;
}

function normalizeContextIdentifier(value: string, fallback: string) {
  return value.trim().toLowerCase() || fallback;
}
