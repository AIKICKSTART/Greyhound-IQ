import { AGENTS_ONBOARDING_ROUTE_TOURS } from "./agents-onboarding-tour-registry";
import { COMMUNITY_ONBOARDING_ROUTE_TOURS } from "./community-onboarding-tour-registry";
import { DESIGN_LAB_ONBOARDING_ROUTE_TOURS } from "./design-lab-onboarding-tour-registry";
import { MARKETPLACE_ONBOARDING_ROUTE_TOURS } from "./marketplace-onboarding-tour-registry";
import {
  ACCOUNT_ONBOARDING_ROUTE_TOURS,
  ADMIN_ONBOARDING_ROUTE_TOURS,
  resolveContextualOnboardingTour,
} from "./onboarding-tour-registry";
import { PUBLIC_ONBOARDING_ROUTE_TOURS } from "./public-onboarding-tour-registry";
import { RACING_ONBOARDING_ROUTE_TOURS } from "./racing-onboarding-tour-registry";

export type OnboardingHelpTourSummary = {
  href: string | null;
  pageLabel: string;
  route: string;
  tourId: string;
};

export type SupportHelpTopic = {
  href: string;
  keywords: readonly string[];
  summary: string;
  title: string;
};

function summarizeTours(
  tours: readonly {
    pageLabel: string;
    route: string;
    tourId: string;
  }[],
) {
  return tours.map(({ pageLabel, route, tourId }) => ({
    href: route.includes("[") ? null : route,
    pageLabel,
    route,
    tourId,
  }));
}

export const ONBOARDING_HELP_TOUR_CATALOGUE = [
  ...summarizeTours(ADMIN_ONBOARDING_ROUTE_TOURS),
  ...summarizeTours(ACCOUNT_ONBOARDING_ROUTE_TOURS),
  ...summarizeTours(RACING_ONBOARDING_ROUTE_TOURS),
  ...summarizeTours(COMMUNITY_ONBOARDING_ROUTE_TOURS),
  ...summarizeTours(PUBLIC_ONBOARDING_ROUTE_TOURS),
  ...summarizeTours(MARKETPLACE_ONBOARDING_ROUTE_TOURS),
  ...summarizeTours(AGENTS_ONBOARDING_ROUTE_TOURS),
  ...summarizeTours(DESIGN_LAB_ONBOARDING_ROUTE_TOURS),
] as const satisfies readonly OnboardingHelpTourSummary[];

export const SUPPORT_HELP_TOPICS = [
  {
    title: "Find and review a race",
    summary: "Search Australian race cards, apply filters, open a race and interpret its runner context before acting.",
    href: "/races",
    keywords: ["race", "form", "runner", "card", "search"],
  },
  {
    title: "Understand tracks and results",
    summary: "Review track context, recent results, times and margins without treating historical data as a guaranteed outcome.",
    href: "/tracks",
    keywords: ["track", "result", "meeting", "time", "margin"],
  },
  {
    title: "Review greyhound profiles",
    summary: "Find a greyhound and review form, trainer and racing records while keeping the selected dog identity in view.",
    href: "/dogs",
    keywords: ["dog", "greyhound", "profile", "trainer", "form"],
  },
  {
    title: "Use community and messaging safely",
    summary: "Open the community feed, understand public and member actions, and use private conversation controls deliberately.",
    href: "/feed",
    keywords: ["feed", "community", "message", "chat", "friend"],
  },
  {
    title: "Buy or sell through the marketplace",
    summary: "Review listing identity, status and seller context before saving, enquiring about or creating a marketplace listing.",
    href: "/marketplace",
    keywords: ["marketplace", "listing", "seller", "buyer", "enquiry"],
  },
  {
    title: "Understand plans and usage",
    summary: "Compare plan access, billing state and measured usage before changing subscription or investigating a limit.",
    href: "/account/billing",
    keywords: ["billing", "plan", "subscription", "usage", "invoice"],
  },
  {
    title: "Protect your account",
    summary: "Review the account security boundary and use the approved identity-provider flow for sensitive identity changes.",
    href: "/account/security",
    keywords: ["security", "password", "identity", "session", "login"],
  },
  {
    title: "Manage privacy and data requests",
    summary: "Review consent and marketing records, request an account export, and understand the account deletion path.",
    href: "/account/privacy",
    keywords: ["privacy", "export", "deletion", "consent", "data"],
  },
  {
    title: "Use AI agents responsibly",
    summary: "Review the available agent workflows, access boundary and responsible-use expectations before starting a run.",
    href: "/agents",
    keywords: ["ai", "agent", "analysis", "responsible", "run"],
  },
  {
    title: "Open a support request",
    summary: "Create a support ticket for account or technical issues, then return here to review its status and history.",
    href: "/contact",
    keywords: ["support", "ticket", "technical", "account", "help"],
  },
] as const satisfies readonly SupportHelpTopic[];

export function getAvailableOnboardingHelpTours({
  authenticated,
  role,
}: {
  authenticated: boolean;
  role: string | null | undefined;
}) {
  return ONBOARDING_HELP_TOUR_CATALOGUE.filter(({ route, tourId }) => {
    const resolved = resolveContextualOnboardingTour(route, {
      authenticated,
      role,
    });
    return resolved?.tourId === tourId;
  });
}

export function normalizeHelpSearchQuery(
  value: string | readonly string[] | null | undefined,
) {
  const selected = Array.isArray(value) ? value[0] : value;
  return (selected ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

export function filterSupportHelpTopics(query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return SUPPORT_HELP_TOPICS;
  return SUPPORT_HELP_TOPICS.filter((topic) =>
    normalizeSearchText(
      [topic.title, topic.summary, ...topic.keywords].join(" "),
    ).includes(normalized),
  );
}

export function filterOnboardingHelpTours(
  tours: readonly OnboardingHelpTourSummary[],
  query: string,
) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return tours;
  return tours.filter((tour) =>
    normalizeSearchText(
      `${tour.pageLabel} ${tour.route} ${tour.tourId}`,
    ).includes(normalized),
  );
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase("en-AU").replace(/\s+/g, " ");
}
