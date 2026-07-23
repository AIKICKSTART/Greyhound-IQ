import demoRouteAuditEvidence from "../../output/demo-route-audit/latest.json";

import { DEMO_PROVIDER_ROUTE_PATHS } from "../lib/demo-route-sample-contract";
import { evaluateDemoRouteAuditEvidence } from "./demo-route-audit-evidence";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";
import { productionScreenCoverage } from "./screen-contracts/production-screen-coverage";
import type {
  CoverageClaim,
  FamilyScreenManifest,
} from "./screen-contracts/types";

export type DemoScreen = {
  route: string;
  href?: string;
  authentication?: ScreenContract["authentication"];
  roles?: readonly string[];
  tiers?: readonly string[];
  noindex?: boolean;
  userStory?: DemoScreenUserStory;
};

export type DemoScreenUserStory = {
  id: string;
  actor: string;
  trigger: string;
  outcome: string;
  acceptance: {
    given: string;
    when: string;
    then: string;
  };
  evidence: {
    source: {
      path: string;
      renderAssertions: readonly [string, ...string[]];
    };
    routeAudit: {
      path: string;
      route: string;
    };
    test:
      | {
          path: "src/components/screen-contracts/public-racing-user-stories.test.ts";
          testId: "PUBLIC-RACING-STORY-CONTRACT";
        }
      | {
          path: "src/components/screen-contracts/community-user-stories.test.ts";
          testId: "COMMUNITY-STORY-CONTRACT";
        }
      | {
          path: "src/components/screen-contracts/marketplace-account-user-stories.test.ts";
          testId: "MARKETPLACE-ACCOUNT-STORY-CONTRACT";
        }
      | {
          path: "src/components/screen-contracts/admin-user-stories.test.ts";
          testId: "ADMIN-STORY-CONTRACT";
        }
      | {
          path: "src/components/screen-contracts/ai-user-stories.test.ts";
          testId: "AI-STORY-CONTRACT";
        };
  };
  coverage:
    | {
        status: "captured";
        blocker: {
          owner: "Route-audit evidence lane";
          reason: string;
        };
      }
    | {
        status: "tested";
        blocker?: never;
      };
};

export const SCREEN_CONTRACT_COVERAGE_AREAS = [
  "route",
  "userStories",
  "actions",
  "forms",
  "permissions",
  "states",
  "designLab",
  "onboarding",
  "tests",
] as const;

export type ScreenContractCoverageArea =
  (typeof SCREEN_CONTRACT_COVERAGE_AREAS)[number];

export type ScreenContractCoverageStatus =
  | "not-started"
  | "captured"
  | "verified"
  | "tested"
  | "blocked"
  | "excluded";

export type ScreenContractCoverage = {
  status: ScreenContractCoverageStatus;
  evidence: readonly string[];
};

export type ScreenContract = {
  id: string;
  route: string;
  concreteRoute: string;
  routePattern?: string;
  title: string;
  productArea: string;
  description: string;
  actors: string[];
  authentication: "public" | "optional" | "required";
  roles: string[];
  tiers: string[];
  featureFlags: string[];
  dynamicParameters: string[];
  queryParameters: string[];
  entryPoints: string[];
  primaryActions: string[];
  secondaryActions: string[];
  forms: string[];
  permissionRules: FamilyScreenManifest["permissions"];
  dataDependencies: string[];
  stateRules: FamilyScreenManifest["states"];
  supportedStates: string[];
  onboardingTourId?: string;
  designLabFixtureIds: string[];
  noindex: boolean;
  productionEnabled: boolean;
  sourceFiles: string[];
  coverage: Record<ScreenContractCoverageArea, ScreenContractCoverage>;
};

export type DemoScreenFamily = {
  key: string;
  label: string;
  audience: string;
  userStory: string;
  acceptance: readonly string[];
  screens: readonly DemoScreen[];
};

const COMMON_ACCEPTANCE = [
  "Default, loading, empty and recoverable-error states are understandable.",
  "Keyboard focus, semantic labels and 44px primary touch targets are preserved.",
  "No horizontal overflow at phone, tablet or desktop breakpoints.",
] as const;

type ProductionBaselineStoryInput = Pick<
  DemoScreenUserStory,
  "id" | "actor" | "outcome" | "acceptance"
> & {
  renderAssertions: readonly [string, ...string[]];
};

function productionBaselineStory(
  route: string,
  samplePath: string,
  input: ProductionBaselineStoryInput,
  test: DemoScreenUserStory["evidence"]["test"] = {
    path: "src/components/screen-contracts/public-racing-user-stories.test.ts",
    testId: "PUBLIC-RACING-STORY-CONTRACT",
  }
): DemoScreenUserStory {
  return {
    id: input.id,
    actor: input.actor,
    trigger: `Open ${samplePath}`,
    outcome: input.outcome,
    acceptance: input.acceptance,
    evidence: {
      source: {
        path: routeSourceFile(route),
        renderAssertions: input.renderAssertions,
      },
      routeAudit: {
        path: "output/demo-route-audit/latest.json",
        route,
      },
      test,
    },
    coverage: { status: "tested" },
  };
}

function communityBaselineStory(
  route: string,
  samplePath: string,
  input: ProductionBaselineStoryInput
) {
  return productionBaselineStory(route, samplePath, input, {
    path: "src/components/screen-contracts/community-user-stories.test.ts",
    testId: "COMMUNITY-STORY-CONTRACT",
  });
}

function marketplaceAccountBaselineStory(
  route: string,
  samplePath: string,
  input: ProductionBaselineStoryInput
) {
  return productionBaselineStory(route, samplePath, input, {
    path:
      "src/components/screen-contracts/marketplace-account-user-stories.test.ts",
    testId: "MARKETPLACE-ACCOUNT-STORY-CONTRACT",
  });
}

function adminBaselineStory(
  route: string,
  input: ProductionBaselineStoryInput
) {
  return productionBaselineStory(route, route, input, {
    path: "src/components/screen-contracts/admin-user-stories.test.ts",
    testId: "ADMIN-STORY-CONTRACT",
  });
}

function aiBaselineStory(input: ProductionBaselineStoryInput) {
  return productionBaselineStory("/agents", "/agents", input, {
    path: "src/components/screen-contracts/ai-user-stories.test.ts",
    testId: "AI-STORY-CONTRACT",
  });
}

export const DEMO_SCREEN_FAMILIES: readonly DemoScreenFamily[] = [
  {
    key: "public",
    label: "Public website",
    audience: "Visitor and prospective member",
    userStory: "As a visitor, I can understand GreyhoundIQ, compare plans, contact the team and review legal terms before creating an account.",
    acceptance: [
      ...COMMON_ACCEPTANCE,
      "Primary calls to action lead to a real next screen and legal links remain public.",
    ],
    screens: [
      {
        route: "/",
        userStory: productionBaselineStory("/", "/", {
          id: "PUBLIC.STORY.HOME",
          actor: "Visitor",
          outcome:
            "See GreyhoundIQ's Australian racing proposition and today's meeting summary, including a clear no-meetings fallback.",
          acceptance: {
            given: "The current race day may contain meetings or no meeting data.",
            when: "The visitor opens the public home route.",
            then: "The page identifies today's races and renders either meeting context or the explicit no-meetings message.",
          },
          renderAssertions: [
            "Today&apos;s Races",
            "No meetings are available for this race day yet",
            "Breeding Analytics",
          ],
        }),
      },
      {
        route: "/about",
        userStory: productionBaselineStory("/about", "/about", {
          id: "PUBLIC.STORY.ABOUT",
          actor: "Prospective member",
          outcome:
            "Understand why GreyhoundIQ exists, what it believes, and where to continue a public enquiry.",
          acceptance: {
            given: "The prospective member has not created an account.",
            when: "They open the About route.",
            then: "The page presents the product purpose, guiding beliefs, and a visible contact section.",
          },
          renderAssertions: [
            "Why we built it",
            "What we believe",
            "Get in touch",
          ],
        }),
      },
      {
        route: "/auth/error",
        userStory: productionBaselineStory("/auth/error", "/auth/error", {
          id: "PUBLIC.STORY.AUTH-ERROR",
          actor: "Visitor with an interrupted sign-in",
          outcome:
            "Receive safe, generic recovery guidance without exposing authentication internals.",
          acceptance: {
            given: "A sign-in attempt has returned the visitor to the public error route.",
            when: "The recovery page renders.",
            then: "It labels the recovery state and presents sign-in and support recovery choices without raw internal error details.",
          },
          renderAssertions: [
            "Secure sign-in recovery",
            "Try sign-in again",
            "Contact support",
          ],
        }),
      },
      {
        route: "/contact",
        userStory: productionBaselineStory("/contact", "/contact", {
          id: "PUBLIC.STORY.CONTACT",
          actor: "Visitor seeking support",
          outcome:
            "Find GreyhoundIQ's public support channel and understand the account boundary for ticket creation.",
          acceptance: {
            given: "The visitor needs help but may not be signed in.",
            when: "They open the Contact route.",
            then: "The page shows the support email and clearly identifies that ticket creation begins after sign-in.",
          },
          renderAssertions: [
            "Talk to us.",
            "support@greyhoundiq.com.au",
            "Sign in to create a ticket",
          ],
        }),
      },
      {
        route: "/advertise",
        userStory: productionBaselineStory("/advertise", "/advertise", {
          id: "PUBLIC.STORY.ADVERTISE",
          actor: "Prospective advertiser",
          outcome:
            "Review GreyhoundIQ's viewable-impression Feed rate card and Marketplace boost packages, then reach the team to book a campaign.",
          acceptance: {
            given: "The visitor is evaluating paid placement without a purchase claim.",
            when: "They open the Advertise route.",
            then: "The page identifies the GST-inclusive AUD rate card, boost packages, and the contact-to-book campaign path.",
          },
          renderAssertions: [
            "Viewable-impression rate card",
            "Book a campaign",
            "Marketplace boosts",
          ],
        }),
      },
      {
        route: "/advertise/policy",
        userStory: productionBaselineStory(
          "/advertise/policy",
          "/advertise/policy",
          {
            id: "PUBLIC.STORY.ADVERTISE-POLICY",
            actor: "Advertiser reviewing policy",
            outcome:
              "Understand the advertising viewability, creative, frequency, privacy and refund rules before committing spend to a campaign or boost.",
            acceptance: {
              given: "The visitor wants the advertising policy before booking.",
              when: "They open the Advertising Policy route.",
              then: "The page restates the creative rules, viewability definition, organic-gap protections and refund and cancellation basics.",
            },
            renderAssertions: ["Advertising Policy", "Creative rules", "Refunds"],
          }
        ),
      },
      {
        route: "/pricing",
        userStory: productionBaselineStory("/pricing", "/pricing", {
          id: "PUBLIC.STORY.PRICING",
          actor: "Prospective member",
          outcome:
            "Compare the published Australian-dollar plan information and common pricing questions before choosing whether to join.",
          acceptance: {
            given: "The prospective member is evaluating GreyhoundIQ without a purchase claim.",
            when: "They open the Pricing route.",
            then: "The page identifies simple AUD pricing and provides the published plan comparison and common questions.",
          },
          renderAssertions: ["Simple, honest", "AUD pricing", "Common questions"],
        }),
      },
      {
        route: "/privacy",
        userStory: productionBaselineStory("/privacy", "/privacy", {
          id: "PUBLIC.STORY.PRIVACY",
          actor: "Visitor reviewing data handling",
          outcome:
            "Understand the published privacy commitments, Australian Privacy Principles reference, and personal-data rights.",
          acceptance: {
            given: "The visitor wants privacy information before using the service.",
            when: "They open the Privacy route.",
            then: "The page identifies the privacy policy, its APP context, and the visitor's stated rights.",
          },
          renderAssertions: [
            "Privacy Policy",
            "Australian Privacy Principles (APPs)",
            "Your rights",
          ],
        }),
      },
      {
        route: "/responsible-use",
        userStory: productionBaselineStory(
          "/responsible-use",
          "/responsible-use",
          {
            id: "PUBLIC.STORY.RESPONSIBLE-USE",
            actor: "Adult visitor",
            outcome:
              "Understand that racing intelligence is not betting advice and see an Australian support contact.",
            acceptance: {
              given: "The visitor is reviewing the service's responsible-use boundary.",
              when: "They open the Responsible Use route.",
              then: "The page states the information boundary and displays the published support service and phone number.",
            },
            renderAssertions: [
              "Information, not betting advice",
              "Support is available",
              "1800 858 858",
            ],
          }
        ),
      },
      {
        route: "/terms",
        userStory: productionBaselineStory("/terms", "/terms", {
          id: "PUBLIC.STORY.TERMS",
          actor: "Visitor reviewing service conditions",
          outcome:
            "Read the published service conditions, adult-use boundary, and liability limitations before using GreyhoundIQ.",
          acceptance: {
            given: "The visitor needs the governing public conditions.",
            when: "They open the Terms route.",
            then: "The page renders the Terms of Service with the 18+ responsible-racing and limitation-of-liability sections.",
          },
          renderAssertions: [
            "Terms of Service",
            "3. 18+ and responsible racing",
            "8. Limitation of liability",
          ],
        }),
      },
    ],
  },
  {
    key: "racing",
    label: "Racing intelligence",
    audience: "Visitor and signed-in racing member",
    userStory: "As a racing member, I can move from meetings to races, dogs, tracks, results, statistics and breeding context without losing my place.",
    acceptance: [
      ...COMMON_ACCEPTANCE,
      "Filters, cards and detail links produce a meaningful result or a clear no-data state.",
      "Dynamic details handle missing records without exposing internal errors.",
    ],
    screens: [
      {
        route: "/breeding",
        userStory: productionBaselineStory("/breeding", "/breeding", {
          id: "RACING.STORY.BREEDING",
          actor: "Racing visitor",
          outcome:
            "See current sire-leader context while distinguishing live information from planned Phase 2 breeding capabilities.",
          acceptance: {
            given: "The visitor wants breeding context from the currently available product.",
            when: "They open the Breeding route.",
            then: "The page renders the active sire section and visibly labels the separate Phase 2 capability and delivery context.",
          },
          renderAssertions: [
            "Top Active Sires",
            "What ships in Phase 2",
            "Shipping in 6-8 weeks",
          ],
        }),
      },
      {
        route: "/breeding/cross",
        userStory: productionBaselineStory("/breeding/cross", "/breeding/cross", {
          id: "RACING.STORY.BREEDING-CROSS",
          actor: "Breeding researcher",
          outcome:
            "Compare the verified historical record of any selected sire and dam pairing without presenting the result as a prediction, behind the Pro gate.",
          acceptance: {
            given: "The visitor wants to inspect a possible sire and dam pairing.",
            when: "They open Test Mating.",
            then: "The page renders Test Mating and the CrossAnalysis surface for Pro members or the Pro upsell for others.",
          },
          renderAssertions: [
            "Test mating",
            "Any sire × any dam",
            "<CrossAnalysis />",
          ],
        }),
      },
      {
        route: "/breeding/dams/[id]",
        href: "/breeding/dams/demo-provider-dog",
        userStory: productionBaselineStory(
          "/breeding/dams/[id]",
          "/breeding/dams/demo-provider-dog",
          {
            id: "RACING.STORY.BREEDING-DAM",
            actor: "Breeding researcher",
            outcome:
              "Review a selected dam's progeny record and top performers, or a not-found result for a missing record.",
            acceptance: {
              given: "A concrete dam identifier is present in the route.",
              when: "The visitor opens the registered dam-detail sample path.",
              then: "The page binds a missing dam to not-found and renders the dam statistics and progeny record for a found record.",
            },
            renderAssertions: [
              "if (!stats) notFound();",
              "Dam statistics",
              "<BreedingProgenyRecord",
            ],
          }
        ),
      },
      {
        route: "/breeding/sires/[id]",
        href: "/breeding/sires/demo-provider-dog",
        userStory: productionBaselineStory(
          "/breeding/sires/[id]",
          "/breeding/sires/demo-provider-dog",
          {
            id: "RACING.STORY.BREEDING-SIRE",
            actor: "Breeding researcher",
            outcome:
              "Review a selected sire's progeny record, best crosses and top performers, or a not-found result for a missing record.",
            acceptance: {
              given: "A concrete sire identifier is present in the route.",
              when: "The visitor opens the registered sire-detail sample path.",
              then: "The page binds a missing sire to not-found and renders the sire statistics, progeny record and top dam partners for a found record.",
            },
            renderAssertions: [
              "if (!stats) notFound();",
              "Sire statistics",
              "Top dam partners (best crosses)",
            ],
          }
        ),
      },
      {
        route: "/vets",
        userStory: productionBaselineStory("/vets", "/vets", {
          id: "RACING.STORY.VET-FINDER",
          actor: "Greyhound carer",
          outcome:
            "Find and filter greyhound-friendly veterinary clinics, then open contact or direction details.",
          acceptance: {
            given: "The visitor needs a greyhound-friendly veterinary clinic.",
            when: "They open Vet Finder and use its search or filters.",
            then: "The page renders the Australian clinic finder and a usable VetFinder control surface.",
          },
          renderAssertions: [
            "VET FINDER",
            "Greyhound-friendly vets across",
            "<VetFinder />",
          ],
        }),
      },
      {
        route: "/dogs",
        userStory: productionBaselineStory("/dogs", "/dogs", {
          id: "RACING.STORY.DOG-SEARCH",
          actor: "Racing visitor",
          outcome:
            "See the national greyhound-search surface, current dataset tallies, and any initial query handed to that surface.",
          acceptance: {
            given: "The route may be opened with or without an initial search query.",
            when: "The visitor opens the Dogs route.",
            then: "The page identifies dog search, renders greyhound tallies, and mounts the search surface with the initial query value.",
          },
          renderAssertions: [
            'badge="DOG SEARCH"',
            "<DogSearch initialQuery={initialQuery}",
            'label: "Greyhounds"',
          ],
        }),
      },
      {
        route: "/dogs/[id]",
        href: DEMO_PROVIDER_ROUTE_PATHS.dog,
        userStory: productionBaselineStory(
          "/dogs/[id]",
          DEMO_PROVIDER_ROUTE_PATHS.dog,
          {
            id: "RACING.STORY.DOG-DETAIL",
            actor: "Racing visitor",
            outcome:
              "Review the selected greyhound's identity, ownership status, pedigree, and recent form, with a not-found result for a missing record.",
            acceptance: {
              given: "A concrete greyhound identifier is present in the route.",
              when: "The visitor opens the registered dog-detail sample path.",
              then: "The page source binds missing records to not-found and renders ownership, pedigree, and recent-form sections for a found record.",
            },
            renderAssertions: [
              "if (!dog) notFound();",
              "Ownership",
              "Pedigree",
              "Recent Form",
            ],
          }
        ),
      },
      {
        route: "/races",
        userStory: productionBaselineStory("/races", "/races", {
          id: "RACING.STORY.RACE-EXPLORER",
          actor: "Racing visitor",
          outcome:
            "See the race-control schedule grouped by track or an explicit no-races result for the current view.",
          acceptance: {
            given: "The current race view may contain matching races or no matches.",
            when: "The visitor opens the Races route.",
            then: "The page renders race-control and racecard context, or the explicit no-races message.",
          },
          renderAssertions: [
            "Race control",
            "Racecards by track",
            "No races match these filters",
          ],
        }),
      },
      {
        route: "/meetings/[id]",
        href: DEMO_PROVIDER_ROUTE_PATHS.meeting,
        userStory: productionBaselineStory(
          "/meetings/[id]",
          DEMO_PROVIDER_ROUTE_PATHS.meeting,
          {
            id: "RACING.STORY.MEETING-DETAIL",
            actor: "Racing visitor",
            outcome:
              "Open one stored meeting to review its track, measured summary, racecard, results and replay availability without inferred statistics.",
            acceptance: {
              given: "A concrete stored meeting identifier is present in the route.",
              when: "The visitor opens the registered meeting-detail sample path.",
              then: "The page binds a missing meeting to not-found and derives every count and race state from stored meeting, runner, result and replay rows.",
            },
            renderAssertions: [
              "if (!meeting) notFound();",
              "Meeting racecard",
              "Races with results",
              "No race rows are available for this stored meeting.",
            ],
          },
        ),
      },
      {
        route: "/races/[id]",
        href: DEMO_PROVIDER_ROUTE_PATHS.race,
        userStory: productionBaselineStory(
          "/races/[id]",
          DEMO_PROVIDER_ROUTE_PATHS.race,
          {
            id: "RACING.STORY.RACE-DETAIL",
            actor: "Racing visitor",
            outcome:
              "Review the selected race's runners, available results, and race summary, with a not-found result for a missing record.",
            acceptance: {
              given: "A concrete race identifier is present in the route.",
              when: "The visitor opens the registered race-detail sample path.",
              then: "The page source binds missing records to not-found and renders runners-and-results plus race-summary sections for a found record.",
            },
            renderAssertions: [
              "if (!race) notFound();",
              "Runners and results",
              "No runners loaded for this race yet.",
              "Race summary",
            ],
          }
        ),
      },
      {
        route: "/results",
        userStory: productionBaselineStory("/results", "/results", {
          id: "RACING.STORY.RESULTS",
          actor: "Racing visitor",
          outcome:
            "See settled race-result rows or an explicit no-results state when no settled data is available.",
          acceptance: {
            given: "The selected result view may contain settled races or no result data.",
            when: "The visitor opens the Results route.",
            then: "The page renders result rows when present and otherwise displays the explicit no-settled-results message.",
          },
          renderAssertions: [
            'title="Results"',
            "<RunnerRow key={runner.id} runner={runner} showResults />",
            "No settled race results are available yet",
          ],
        }),
      },
      {
        route: "/statistics",
        userStory: productionBaselineStory("/statistics", "/statistics", {
          id: "RACING.STORY.STATISTICS",
          actor: "Racing visitor",
          outcome:
            "Review national box-win rates, trainer leaders, and current track records from the available dataset.",
          acceptance: {
            given: "Statistics queries return the currently available aggregate rows.",
            when: "The visitor opens the Statistics route.",
            then: "The page renders the box-win-rate, trainer-leaderboard, and current-track-record sections.",
          },
          renderAssertions: [
            "Box Win Rate — All Tracks",
            "Trainer Leaderboard",
            "Current Track Records",
          ],
        }),
      },
      {
        route: "/tracks",
        userStory: productionBaselineStory("/tracks", "/tracks", {
          id: "RACING.STORY.TRACKS",
          actor: "Racing visitor",
          outcome:
            "See active Australian racing venues and their current meeting context, or a clear no-tracks result for the selected state.",
          acceptance: {
            given: "The current state view may contain matching tracks or no matches.",
            when: "The visitor opens the Tracks route.",
            then: "The page renders the all-venues collection or the explicit no-tracks message.",
          },
          renderAssertions: [
            'title="All venues"',
            "active venues shown",
            "No tracks match this state filter.",
          ],
        }),
      },
      {
        route: "/tracks/[id]",
        href: DEMO_PROVIDER_ROUTE_PATHS.track,
        userStory: productionBaselineStory(
          "/tracks/[id]",
          DEMO_PROVIDER_ROUTE_PATHS.track,
          {
            id: "RACING.STORY.TRACK-DETAIL",
            actor: "Racing visitor",
            outcome:
              "Review the selected venue's recent meetings, track profile, and box-win context, with a not-found result for a missing record.",
            acceptance: {
              given: "A concrete track identifier is present in the route.",
              when: "The visitor opens the registered track-detail sample path.",
              then: "The page source binds missing records to not-found and renders recent-meetings, track-profile, and box-wins sections for a found record.",
            },
            renderAssertions: [
              "if (!track) notFound();",
              "Recent meetings",
              "Track profile",
              "Box wins",
            ],
          }
        ),
      },
    ],
  },
  {
    key: "community",
    label: "Community and messaging",
    audience: "Member, seller and community participant",
    userStory: "As a member, I can discover people, publish and react in Feed, join groups, and continue private conversations with clear privacy boundaries.",
    acceptance: [
      ...COMMON_ACCEPTANCE,
      "Create, like, comment, save, share and message controls show immediate state feedback.",
      "Signed-out, blocked, private and missing-thread states never leak protected content.",
    ],
    screens: [
      {
        route: "/discover",
        userStory: communityBaselineStory("/discover", "/discover", {
          id: "COMMUNITY.STORY.DISCOVER",
          actor: "Community visitor",
          outcome:
            "Search GreyhoundIQ's public community directory for people, managed pages, businesses, and greyhounds, with explicit initial and no-match states.",
          acceptance: {
            given:
              "The route may have no query, a short query, or a query with matching or zero results.",
            when: "The visitor opens the Discover route.",
            then: "The page renders the community search control and either initial guidance, grouped results, or a named no-match state.",
          },
          renderAssertions: [
            "Community directory",
            "Search the community",
            "No matches for",
          ],
        }),
      },
      {
        route: "/feed",
        userStory: communityBaselineStory("/feed", "/feed", {
          id: "COMMUNITY.STORY.FEED",
          actor: "Community visitor or signed-in member",
          outcome:
            "Read community posts with a clear sign-in boundary for interaction, or use the signed-in feed order and identity-aware composer surface.",
          acceptance: {
            given:
              "The route may be opened by a visitor or by a member using a personal or managed-page identity.",
            when: "They open the Feed route.",
            then: "The source renders a non-interactive public feed, signed-in For You and Latest ordering, and the managed-page Pro boundary.",
          },
          renderAssertions: [
            "Community feed.",
            "canInteract={false}",
            'aria-label="Feed order"',
            "Managed pages require Pro",
          ],
        }),
      },
      {
        route: "/forum",
        userStory: communityBaselineStory("/forum", "/forum", {
          id: "COMMUNITY.STORY.FORUM-DIRECTORY",
          actor: "Community visitor or signed-in member",
          outcome:
            "Browse public community groups and recent threads, with a member header when signed in and an explicit no-groups state when empty.",
          acceptance: {
            given:
              "The directory may be opened signed out or signed in, with populated or empty group data.",
            when: "They open the Forum directory route.",
            then: "The page presents community groups and latest threads, or the explicit no-community-groups state.",
          },
          renderAssertions: [
            "Community groups",
            "Latest threads",
            "No community groups yet",
          ],
        }),
      },
      {
        route: "/forum/[slug]",
        href: "/forum/general",
        userStory: communityBaselineStory(
          "/forum/[slug]",
          "/forum/general",
          {
            id: "COMMUNITY.STORY.FORUM-GROUP",
            actor: "Community visitor or signed-in member",
            outcome:
              "Review one public group's threads or empty state, while missing groups resolve to not-found and thread creation remains behind sign-in.",
            acceptance: {
              given:
                "A concrete group slug may resolve to a populated group, an empty group, or no group.",
              when: "They open the registered Forum group sample path.",
              then: "The page binds a missing group to not-found and shows threads or the empty state plus the signed-in or sign-in creation boundary.",
            },
            renderAssertions: [
              "if (!category) notFound();",
              "No group threads here yet.",
              "Sign in to start a group thread. Public browsing stays open.",
            ],
          }
        ),
      },
      {
        route: "/forum/threads/[id]",
        href: "/forum/threads/demo-route-audit-thread",
        userStory: communityBaselineStory(
          "/forum/threads/[id]",
          "/forum/threads/demo-route-audit-thread",
          {
            id: "COMMUNITY.STORY.FORUM-THREAD",
            actor: "Community visitor or signed-in member",
            outcome:
              "Read a selected public group thread and its posts, with not-found, locked-thread, and signed-out reply boundaries rendered explicitly.",
            acceptance: {
              given:
                "A concrete thread identifier may resolve to an available, locked, or missing public thread.",
              when: "They open the registered Forum thread sample path.",
              then: "The page binds missing threads to not-found and shows posts with either a locked notice, reply form, or sign-in prompt.",
            },
            renderAssertions: [
              "if (!thread) notFound();",
              "This thread is locked.",
              "Sign in to reply to this thread.",
            ],
          }
        ),
      },
      {
        route: "/groups",
        userStory: communityBaselineStory("/groups", "/groups", {
          id: "COMMUNITY.STORY.GROUPS-DIRECTORY",
          actor: "Community visitor using the Groups URL",
          outcome:
            "Reach the shared public group directory and metadata through the primary Groups path without a divergent second implementation.",
          acceptance: {
            given:
              "The Groups route is the primary navigation path for the existing community directory implementation.",
            when: "The visitor opens the Groups route.",
            then: "The route module delegates both the page and metadata to the registered Forum directory source.",
          },
          renderAssertions: [
            'import GroupsPage, { metadata } from "../forum/page";',
            "export { metadata };",
            "export default GroupsPage;",
          ],
        }),
      },
      {
        route: "/groups/[slug]",
        href: "/groups/general",
        userStory: communityBaselineStory(
          "/groups/[slug]",
          "/groups/general",
          {
            id: "COMMUNITY.STORY.GROUPS-GROUP",
            actor: "Community visitor using a Groups detail URL",
            outcome:
              "Reach the shared group-detail experience and metadata for a concrete slug without duplicating its not-found or sign-in boundaries.",
            acceptance: {
              given:
                "A concrete slug is opened through the Groups detail route.",
              when: "The visitor opens the registered Groups sample path.",
              then: "The route delegates rendering and metadata generation to the registered Forum group-detail source.",
            },
            renderAssertions: [
              "generateMetadata as generateGroupMetadata",
              "return generateGroupMetadata(props);",
              "export default GroupPage;",
            ],
          }
        ),
      },
      {
        route: "/groups/threads/[id]",
        href: "/groups/threads/demo-route-audit-thread",
        userStory: communityBaselineStory(
          "/groups/threads/[id]",
          "/groups/threads/demo-route-audit-thread",
          {
            id: "COMMUNITY.STORY.GROUPS-THREAD",
            actor: "Community visitor using a Groups thread URL",
            outcome:
              "Reach the shared public group-thread experience and metadata for a concrete identifier without duplicating privacy or reply logic.",
            acceptance: {
              given:
                "A concrete public thread identifier is opened through the Groups route family.",
              when: "The visitor opens the registered Groups thread sample path.",
              then: "The route delegates rendering and metadata generation to the registered Forum thread source.",
            },
            renderAssertions: [
              "generateMetadata as generateGroupThreadMetadata",
              "return generateGroupThreadMetadata(props);",
              "export default GroupThreadPage;",
            ],
          }
        ),
      },
      {
        route: "/messages",
        userStory: communityBaselineStory("/messages", "/messages", {
          id: "COMMUNITY.STORY.MESSAGES-INBOX",
          actor: "Pulse visitor or signed-in member",
          outcome:
            "See the private-messaging boundary when signed out, or a signed-in inbox with unread, empty, friends, and new-message surfaces.",
          acceptance: {
            given:
              "The Pulse inbox source may render for a visitor or a signed-in member with zero or more conversations.",
            when: "They open the Messages route.",
            then: "The page renders the sign-in privacy boundary or the Pulse inbox with an explicit no-conversations state and composer.",
          },
          renderAssertions: [
            "Sign in to open Pulse",
            "Pulse inbox",
            "No conversations yet",
            "New Pulse message",
          ],
        }),
      },
      {
        route: "/messages/[id]",
        href: "/messages/demo-conversation-admin-pro",
        userStory: communityBaselineStory(
          "/messages/[id]",
          "/messages/demo-conversation-admin-pro",
          {
            id: "COMMUNITY.STORY.MESSAGES-THREAD",
            actor: "Pulse visitor or conversation participant",
            outcome:
              "Receive a sign-in boundary before private lookup, while a resolved participant thread shows conversation, search, blocked, and empty-message states.",
            acceptance: {
              given:
                "A concrete conversation identifier is opened signed out or by a signed-in profile.",
              when: "They open the registered Messages thread sample path.",
              then: "The source returns the signed-out view before lookup, maps an inaccessible thread to not-found, and renders explicit private and blocked states for a resolved thread.",
            },
            renderAssertions: [
              "if (!user?.profileId || !user.dbUserId) return <SignedOutThread />;",
              "Private Pulse conversation",
              "You blocked this conversation. Unblock before sending new messages.",
              "Sign in to view this Pulse conversation",
            ],
          }
        ),
      },
      {
        route: "/messages/friends",
        userStory: communityBaselineStory(
          "/messages/friends",
          "/messages/friends",
          {
            id: "COMMUNITY.STORY.MESSAGES-FRIENDS",
            actor: "Pulse visitor or signed-in member",
            outcome:
              "See a sign-in boundary when anonymous, or accepted friends with empty, message, voice, and video entry-point states when signed in.",
            acceptance: {
              given:
                "The friends route may be opened signed out or by a member with zero or more accepted friends.",
              when: "They open the Messages friends route.",
              then: "The page renders sign-in or no-friends guidance and exposes message and call links only for rows with a conversation identifier.",
            },
            renderAssertions: [
              "Sign in to view friends",
              "No friends yet",
              "Message, voice, and video.",
              "friend.conversationId ?",
            ],
          }
        ),
      },
      {
        route: "/p/[handle]",
        href: "/p/demo-control-room",
        userStory: communityBaselineStory(
          "/p/[handle]",
          "/p/demo-control-room",
          {
            id: "COMMUNITY.STORY.PUBLIC-PROFILE",
            actor: "Community visitor or signed-in member",
            outcome:
              "Resolve a public handle to its personal or managed-page profile, with not-found and signed-out connect or follow boundaries in the same route.",
            acceptance: {
              given:
                "A concrete public handle may identify a personal actor, a managed page, or no published actor.",
              when: "They open the registered public-profile sample path.",
              then: "The page binds missing actors to not-found, selects the matching profile view, and renders a sign-in boundary before connection or follow actions.",
            },
            renderAssertions: [
              "if (!profile) notFound();",
              "<PersonalProfileView",
              "<ManagedPageView",
              "Sign in to connect",
              "Sign in to follow",
            ],
          }
        ),
      },
      {
        route: "/pulse",
        userStory: communityBaselineStory("/pulse", "/pulse", {
          id: "COMMUNITY.STORY.PULSE-INBOX",
          actor: "Pulse visitor or signed-in member",
          outcome:
            "Open the primary Pulse inbox URL and receive the shared private-messaging implementation and metadata without route drift.",
          acceptance: {
            given:
              "Pulse is the primary navigation path for the existing Messages inbox implementation.",
            when: "They open the Pulse route.",
            then: "The route module delegates both the page and metadata to the registered Messages inbox source.",
          },
          renderAssertions: [
            'import PulsePage, { metadata } from "../messages/page";',
            "export { metadata };",
            "export default PulsePage;",
          ],
        }),
      },
      {
        route: "/pulse/[id]",
        href: "/pulse/demo-conversation-admin-pro",
        userStory: communityBaselineStory(
          "/pulse/[id]",
          "/pulse/demo-conversation-admin-pro",
          {
            id: "COMMUNITY.STORY.PULSE-THREAD",
            actor: "Pulse visitor or conversation participant",
            outcome:
              "Open the primary Pulse thread URL and receive the shared private-conversation and metadata behavior without duplicate access logic.",
            acceptance: {
              given:
                "A concrete conversation identifier is opened through the primary Pulse route family.",
              when: "They open the registered Pulse thread sample path.",
              then: "The route delegates rendering and metadata generation to the registered Messages thread source.",
            },
            renderAssertions: [
              "generateMetadata as generatePulseMetadata",
              "return generatePulseMetadata(props);",
              "export default PulseThreadPage;",
            ],
          }
        ),
      },
      {
        route: "/pulse/friends",
        userStory: communityBaselineStory(
          "/pulse/friends",
          "/pulse/friends",
          {
            id: "COMMUNITY.STORY.PULSE-FRIENDS",
            actor: "Pulse visitor or signed-in member",
            outcome:
              "Open the primary Pulse friends URL and receive the shared accepted-friends experience and metadata without a second implementation.",
            acceptance: {
              given:
                "Pulse friends is the primary navigation path for the existing Messages friends implementation.",
              when: "They open the Pulse friends route.",
              then: "The route module delegates both the page and metadata to the registered Messages friends source.",
            },
            renderAssertions: [
              'import PulseFriendsPage, { metadata } from "../../messages/friends/page";',
              "export { metadata };",
              "export default PulseFriendsPage;",
            ],
          }
        ),
      },
    ],
  },
  {
    key: "marketplace",
    label: "Marketplace",
    audience: "Public buyer and signed-in seller",
    userStory: "As a buyer or seller, I can discover verified public profiles, browse every active item, filter, save, enquire and create a listing with truthful media disclosure.",
    acceptance: [
      ...COMMON_ACCEPTANCE,
      "The six verified dog cards remain separate from active listing inventory.",
      "Illustrative media is disclosed and never implies seller, animal or transaction verification.",
      "Create, save and enquiry paths enforce authentication and ownership rules.",
    ],
    screens: [
      {
        route: "/listings",
        userStory: marketplaceAccountBaselineStory(
          "/listings",
          "/listings",
          {
            id: "MARKETPLACE.STORY.LISTINGS-DIRECTORY",
            actor: "Marketplace visitor or signed-in buyer",
            outcome:
              "Browse active marketplace inventory through the compatibility URL, with filtering, empty results, submission feedback, and explicit illustrative-media disclosure.",
            acceptance: {
              given:
                "The compatibility route may contain no filters, active filters, results, no results, or a review-return query.",
              when: "The buyer opens the Listings route.",
              then: "The route canonicalizes to Marketplace while the page source renders inventory, filtered empty states, review feedback, and non-verification disclosure.",
            },
            renderAssertions: [
              "Marketplace item submitted for review.",
              "No items match these filters",
              "All marketplace items",
              "does not verify a listing or seller.",
            ],
          }
        ),
      },
      {
        route: "/listings/[id]",
        href: "/listings/demo-listing-racing-toolkit",
        userStory: marketplaceAccountBaselineStory(
          "/listings/[id]",
          "/listings/demo-listing-racing-toolkit",
          {
            id: "MARKETPLACE.STORY.LISTING-DETAIL",
            actor: "Marketplace visitor, buyer, or listing owner",
            outcome:
              "Review one marketplace item's seller, price, media and status through the compatibility URL, with missing, sign-in, tier, and owner boundaries visible.",
            acceptance: {
              given:
                "A concrete listing identifier may be missing, public to a visitor, or owned or viewed by a signed-in member.",
              when: "They open the registered Listings detail sample path.",
              then: "The route canonicalizes to Marketplace detail while source binds inaccessible items to not-found and renders seller, enquiry-tier, sign-in, and owner-review states.",
            },
            renderAssertions: [
              "notFound();",
              "Upgrade to message seller",
              "Sign in to message seller in Pulse",
              "Awaiting moderator review before this listing appears publicly.",
            ],
          }
        ),
      },
      {
        route: "/listings/[id]/edit",
        href: "/listings/demo-listing-racing-toolkit/edit",
        authentication: "required",
        roles: ["marketplace-seller"],
        tiers: ["pro", "pro_plus"],
        noindex: true,
        userStory: marketplaceAccountBaselineStory(
          "/listings/[id]/edit",
          "/listings/demo-listing-racing-toolkit/edit",
          {
            id: "MARKETPLACE.STORY.LISTING-EDIT",
            actor: "Authenticated Pro marketplace listing owner",
            outcome:
              "Edit one owned marketplace item through the compatibility URL while signed-out, insufficient-tier, missing, and non-owner requests fail before private listing data is rendered.",
            acceptance: {
              given:
                "A concrete listing identifier may be requested by a signed-out visitor, an ineligible member, the owner, or another member.",
              when: "They open the registered Listings edit sample path.",
              then: "The page requires the current profile and Pro tier, resolves the item with an ownership-scoped lookup, and renders the validated editor only for the owner.",
            },
            renderAssertions: [
              "const current = await requireListingEditorProfile(id);",
              'if (!hasTier(current.tier, "pro")) {',
              "listing = await getOwnedListingForCurrentUser(current, id);",
              "<ListingEditForm",
            ],
          }
        ),
      },
      {
        route: "/listings/new",
        userStory: marketplaceAccountBaselineStory(
          "/listings/new",
          "/listings/new",
          {
            id: "MARKETPLACE.STORY.LISTING-CREATE",
            actor: "Prospective or signed-in marketplace seller",
            outcome:
              "Reach the moderated listing-creation boundary through the compatibility URL, with sign-in, Pro-tier, welfare, legal, media, and review states declared.",
            acceptance: {
              given:
                "The route may be opened signed out, on a Free account, or on an eligible Pro account.",
              when: "The seller opens the Listings creation route.",
              then: "The route canonicalizes to Marketplace creation and renders sign-in or upgrade guidance, or the reviewed form with required acknowledgements and private submission wording.",
            },
            renderAssertions: [
              'const canCreateListing = Boolean(user && hasTier(user.tier, "pro"));',
              "I acknowledge this listing is subject to moderator review,",
              "Upgrade to create marketplace items",
              "Sign in to create marketplace items",
            ],
          }
        ),
      },
      {
        route: "/marketplace",
        userStory: marketplaceAccountBaselineStory(
          "/marketplace",
          "/marketplace",
          {
            id: "MARKETPLACE.STORY.MARKETPLACE-DIRECTORY",
            actor: "Marketplace visitor or signed-in buyer",
            outcome:
              "Open the primary Marketplace inventory URL and receive the shared listing directory and metadata without a divergent second implementation.",
            acceptance: {
              given:
                "Marketplace is the primary navigation path for the existing listings directory implementation.",
              when: "The buyer opens the Marketplace route.",
              then: "The route module delegates both the page and metadata to the registered Listings directory source.",
            },
            renderAssertions: [
              'import ListingsPage, { metadata } from "../listings/page";',
              "export { metadata };",
              "export default ListingsPage;",
            ],
          }
        ),
      },
      {
        route: "/marketplace/[id]",
        href: "/marketplace/demo-listing-racing-toolkit",
        userStory: marketplaceAccountBaselineStory(
          "/marketplace/[id]",
          "/marketplace/demo-listing-racing-toolkit",
          {
            id: "MARKETPLACE.STORY.MARKETPLACE-DETAIL",
            actor: "Marketplace visitor, buyer, or listing owner",
            outcome:
              "Open the primary Marketplace detail URL and receive the shared item, seller, access-boundary, and metadata behavior without duplicate logic.",
            acceptance: {
              given:
                "A concrete listing identifier is opened through the primary Marketplace route family.",
              when: "They open the registered Marketplace detail sample path.",
              then: "The route delegates rendering and metadata generation to the registered Listings detail source.",
            },
            renderAssertions: [
              "generateMetadata as generateListingMetadata",
              "return generateListingMetadata(props);",
              "export default ListingDetailPage;",
            ],
          }
        ),
      },
      {
        route: "/marketplace/[id]/edit",
        href: "/marketplace/demo-listing-racing-toolkit/edit",
        authentication: "required",
        roles: ["marketplace-seller"],
        tiers: ["pro", "pro_plus"],
        noindex: true,
        userStory: marketplaceAccountBaselineStory(
          "/marketplace/[id]/edit",
          "/marketplace/demo-listing-racing-toolkit/edit",
          {
            id: "MARKETPLACE.STORY.MARKETPLACE-EDIT",
            actor: "Authenticated Pro marketplace listing owner",
            outcome:
              "Open the primary Marketplace edit URL and receive the shared owner-scoped, Pro-gated editor behavior and metadata without a divergent second implementation.",
            acceptance: {
              given:
                "A concrete owned listing is opened through the primary Marketplace edit route family.",
              when: "The seller opens the registered Marketplace edit sample path.",
              then: "The route delegates rendering and metadata to the registered Listings edit source, which independently enforces authentication, tier, and ownership.",
            },
            renderAssertions: [
              "import ListingEditPage, {",
              'from "../../../listings/[id]/edit/page";',
              "export { metadata };",
              "export default ListingEditPage;",
            ],
          }
        ),
      },
      {
        route: "/marketplace/new",
        userStory: marketplaceAccountBaselineStory(
          "/marketplace/new",
          "/marketplace/new",
          {
            id: "MARKETPLACE.STORY.MARKETPLACE-CREATE",
            actor: "Prospective or signed-in marketplace seller",
            outcome:
              "Open the primary Marketplace creation URL and receive the shared sign-in, tier, moderation, and listing-form behavior without a second implementation.",
            acceptance: {
              given:
                "Marketplace creation is the primary path for the existing listing form and eligibility boundary.",
              when: "The seller opens the Marketplace creation route.",
              then: "The route module delegates both the page and metadata to the registered Listings creation source.",
            },
            renderAssertions: [
              'import NewListingPage, { metadata } from "../../listings/new/page";',
              "export { metadata };",
              "export default NewListingPage;",
            ],
          }
        ),
      },
    ],
  },
  {
    key: "account",
    label: "Account",
    audience: "Authenticated member",
    userStory: "As a signed-in member, I can manage identity, profile, privacy, security, billing, notifications, pages, team, usage and support from one account workspace.",
    acceptance: [
      ...COMMON_ACCEPTANCE,
      "Every form validates before mutation and shows pending, success and recoverable failure feedback.",
      "Billing return paths preserve plan intent and never treat query parameters as payment proof.",
      "A signed-out user is returned safely after authentication without an open redirect.",
    ],
    screens: [
      {
        route: "/account",
        userStory: marketplaceAccountBaselineStory(
          "/account",
          "/account",
          {
            id: "ACCOUNT.STORY.OVERVIEW",
            actor: "Signed-out visitor or authenticated member",
            outcome:
              "See a clear sign-in boundary or the member account workspace for profile, navigation, privacy, deletion, and billing-entry context without implicit payment.",
            acceptance: {
              given:
                "The route may be opened signed out or by a member with a local profile and tier.",
              when: "They open the Account overview route.",
              then: "The page renders sign-in guidance or member profile and privacy sections, and explicitly separates sign-in from starting Stripe Checkout.",
            },
            renderAssertions: [
              "Sign in to manage your account",
              "Profile media",
              "Privacy controls",
              "This button opens Stripe Checkout. Signing in never starts a payment.",
            ],
          }
        ),
      },
      {
        route: "/account/appearance",
        userStory: marketplaceAccountBaselineStory(
          "/account/appearance",
          "/account/appearance",
          {
            id: "ACCOUNT.STORY.APPEARANCE-PREVIEW",
            actor: "Design Lab appearance reviewer",
            outcome:
              "Review app, dock, and Marketplace visual combinations in a non-persistent URL-only studio that is unavailable in production unless previews are explicitly enabled.",
            acceptance: {
              given:
                "The route is opened in an allowed review environment or in production without the preview flag.",
              when: "The reviewer opens the Appearance route.",
              then: "The page resolves to not-found when disabled, otherwise labels the studio preview-only and states that no account, delivery, database, or billing setting is saved.",
            },
            renderAssertions: [
              'process.env.NODE_ENV === "production"',
              "notFound();",
              "Appearance Studio",
              "Preview only — saving is disabled",
              "Selections live only in this page URL. No account, database,",
            ],
          }
        ),
      },
      {
        route: "/account/billing",
        userStory: marketplaceAccountBaselineStory(
          "/account/billing",
          "/account/billing",
          {
            id: "ACCOUNT.STORY.BILLING",
            actor: "Signed-out visitor or authenticated billing member",
            outcome:
              "See a sign-in boundary or read local plan, entitlement, invoice, and return-state snapshots without treating checkout or portal query parameters as payment proof.",
            acceptance: {
              given:
                "The route may be signed out or carry checkout or portal return parameters for a signed-in account.",
              when: "They open the Billing route.",
              then: "The page renders sign-in or local billing snapshots and states that only a verified signed Stripe webhook changes plan state.",
            },
            renderAssertions: [
              "Sign in to view billing",
              "Returned from Stripe Checkout",
              "The local plan only changes after the signed Stripe webhook is",
              "No local invoices",
            ],
          }
        ),
      },
      {
        route: "/account/listings",
        noindex: true,
        userStory: marketplaceAccountBaselineStory(
          "/account/listings",
          "/account/listings",
          {
            id: "ACCOUNT.STORY.LISTINGS",
            actor: "Authenticated marketplace listing owner",
            outcome:
              "Review the latest one hundred marketplace records owned by the current account across every lifecycle state, with explicit navigation to create, view, and eligible edit paths.",
            acceptance: {
              given:
                "The route may be opened without a session or by a member with zero or more owned listings.",
              when: "They open the My marketplace listings route.",
              then: "The page preserves a safe sign-in return path and otherwise renders only owner-scoped records or the explicit empty state.",
            },
            renderAssertions: [
              'import { SellerListingsViewPage } from "./seller-listings-page";',
              "Review marketplace listings owned by your GreyhoundIQ account.",
              '<SellerListingsViewPage view="all" />',
            ],
          }
        ),
      },
      {
        route: "/account/listings/archived",
        noindex: true,
        userStory: marketplaceAccountBaselineStory(
          "/account/listings/archived",
          "/account/listings/archived",
          {
            id: "ACCOUNT.STORY.LISTINGS-ARCHIVED",
            actor: "Authenticated marketplace listing owner",
            outcome:
              "Review the latest one hundred archived marketplace records owned by the current account without exposing another seller's inventory or unavailable edit controls.",
            acceptance: {
              given:
                "The route may be opened without a session or by a member with zero or more archived listings.",
              when: "They open the Archived marketplace listings route.",
              then: "The page preserves a safe sign-in return path and otherwise renders only owner-scoped archived records or the explicit empty state.",
            },
            renderAssertions: [
              'import { SellerListingsViewPage } from "../seller-listings-page";',
              "Review owner-only GreyhoundIQ archived marketplace records.",
              '<SellerListingsViewPage view="archived" />',
            ],
          }
        ),
      },
      {
        route: "/account/listings/drafts",
        noindex: true,
        userStory: marketplaceAccountBaselineStory(
          "/account/listings/drafts",
          "/account/listings/drafts",
          {
            id: "ACCOUNT.STORY.LISTINGS-DRAFTS",
            actor: "Authenticated marketplace listing owner",
            outcome:
              "Review the latest one hundred draft marketplace records owned by the current account before submission, with create, view, and owner-only edit navigation.",
            acceptance: {
              given:
                "The route may be opened without a session or by a member with zero or more draft listings.",
              when: "They open the Marketplace drafts route.",
              then: "The page preserves a safe sign-in return path and otherwise renders only owner-scoped draft records or the explicit empty state.",
            },
            renderAssertions: [
              'import { SellerListingsViewPage } from "../seller-listings-page";',
              "Review owner-only GreyhoundIQ marketplace draft records.",
              '<SellerListingsViewPage view="drafts" />',
            ],
          }
        ),
      },
      {
        route: "/account/notifications",
        userStory: marketplaceAccountBaselineStory(
          "/account/notifications",
          "/account/notifications",
          {
            id: "ACCOUNT.STORY.NOTIFICATIONS",
            actor: "Authenticated member reviewing notifications",
            outcome:
              "Review account-scoped in-app notifications and recorded marketing preferences, with explicit empty states and a signed-out redirect boundary.",
            acceptance: {
              given:
                "The route may be opened without a session or by a member with populated or empty notification records.",
              when: "They open the Notifications route.",
              then: "The page redirects an unauthorised visitor to sign-in and otherwise renders unread, in-app, and marketing-preference states.",
            },
            renderAssertions: [
              'redirect("/sign-in");',
              "In-app notifications",
              "No in-app notifications recorded.",
              "No marketing preferences recorded.",
            ],
          }
        ),
      },
      {
        route: "/account/pages",
        userStory: marketplaceAccountBaselineStory(
          "/account/pages",
          "/account/pages",
          {
            id: "ACCOUNT.STORY.MANAGED-PAGES",
            actor: "Authenticated member managing public identities",
            outcome:
              "See the Pro boundary or manage account-owned pages and empty creation states, while bespoke checkout returns remain non-authoritative until webhook confirmation.",
            acceptance: {
              given:
                "The member may be below Pro, have zero or more managed pages, or return from bespoke checkout.",
              when: "They open the Managed Pages route.",
              then: "The page renders the tier boundary or owned-page inventory and states that a return URL alone never changes payment or request status.",
            },
            renderAssertions: [
              "const current = await requireCurrentUserProfile();",
              "Custom pages are a Pro feature",
              "Your managed pages",
              "the URL alone never",
              "Create your first page",
            ],
          }
        ),
      },
      {
        route: "/account/pages/[id]",
        href: "/account/pages/demo-custom-page-control-room",
        userStory: marketplaceAccountBaselineStory(
          "/account/pages/[id]",
          "/account/pages/demo-custom-page-control-room",
          {
            id: "ACCOUNT.STORY.MANAGED-PAGE-DETAIL",
            actor: "Authenticated owner of a managed page",
            outcome:
              "Review one owned page's identity, contact visibility, media, publish, save, and deletion surfaces, with missing or unowned identifiers resolving to not-found.",
            acceptance: {
              given:
                "A concrete managed-page identifier may belong to the current member or be unavailable to them.",
              when: "They open the registered Managed Page sample path.",
              then: "The source performs an owner-scoped lookup, binds a missing result to not-found, and labels private contact, combined save, and destructive deletion boundaries.",
            },
            renderAssertions: [
              "const page = await getOwnedCustomPage(current, id);",
              "if (!page) notFound();",
              "Contact fields stay private until you choose an audience.",
              "Save identity, contact, and media changes together.",
              "Delete managed page",
            ],
          }
        ),
      },
      {
        route: "/account/privacy",
        userStory: marketplaceAccountBaselineStory(
          "/account/privacy",
          "/account/privacy",
          {
            id: "ACCOUNT.STORY.PRIVACY",
            actor: "Authenticated member reviewing privacy records",
            outcome:
              "Review account-scoped export, terms, consent, and marketing records with explicit empty states and a signed-out redirect boundary.",
            acceptance: {
              given:
                "The route may be opened without a session or by a member with populated or empty privacy records.",
              when: "They open the Privacy route.",
              then: "The page redirects an unauthorised visitor to sign-in and otherwise renders privacy totals plus explicit empty record states.",
            },
            renderAssertions: [
              'redirect("/sign-in");',
              "Privacy records",
              "No export artifacts recorded.",
              "No terms acceptances recorded.",
              "No consent events recorded.",
            ],
          }
        ),
      },
      {
        route: "/account/profile",
        userStory: marketplaceAccountBaselineStory(
          "/account/profile",
          "/account/profile",
          {
            id: "ACCOUNT.STORY.PROFILE-STUDIO",
            actor: "Authenticated member editing profile media",
            outcome:
              "Review and position cover and profile media in an authenticated studio while current public images remain live until replacements pass safety processing.",
            acceptance: {
              given:
                "The route may be opened signed out or by a member with current or pending profile media.",
              when: "They open the Profile Studio route.",
              then: "The source preserves a safe return-to sign-in redirect and labels the private safety pipeline, live cover preview, and profile-photo editor.",
            },
            renderAssertions: [
              'redirect("/sign-in?returnTo=/account/profile")',
              "Profile Studio",
              "Private safety pipeline",
              "Your current images stay live until replacements pass safety processing.",
            ],
          }
        ),
      },
      {
        route: "/account/saved-listings",
        userStory: marketplaceAccountBaselineStory(
          "/account/saved-listings",
          "/account/saved-listings",
          {
            id: "ACCOUNT.STORY.SAVED-LISTINGS",
            actor: "Authenticated marketplace buyer",
            outcome:
              "Review account-scoped saved marketplace items with price, location, expiry, and saved-date context, or an explicit empty state and sign-in redirect.",
            acceptance: {
              given:
                "The route may be opened without a session or by a member with zero or more saved items.",
              when: "They open the Saved Listings route.",
              then: "The page redirects an unauthorised visitor and otherwise renders saved item cards or the no-saved-items state with a Marketplace return.",
            },
            renderAssertions: [
              'redirect("/sign-in");',
              "Saved items",
              "No saved marketplace items yet",
              "Save active marketplace items from their detail page.",
            ],
          }
        ),
      },
      {
        route: "/account/security",
        userStory: marketplaceAccountBaselineStory(
          "/account/security",
          "/account/security",
          {
            id: "ACCOUNT.STORY.SECURITY",
            actor: "Authenticated member reviewing account security",
            outcome:
              "Review safe local account fields and the WorkOS identity handoff without exposing provider identifiers, tokens, cookies, or session internals.",
            acceptance: {
              given:
                "The route may be opened without a session or by an authenticated member.",
              when: "They open the Security route.",
              then: "The page redirects an unauthorised visitor and otherwise shows safe local fields plus an explicit external identity-management boundary.",
            },
            renderAssertions: [
              'redirect("/sign-in");',
              "WorkOS protects sign-in and sessions; GreyhoundIQ shows only safe",
              "Local account fields",
              "does not display WorkOS identifiers, tokens, cookies, or session",
            ],
          }
        ),
      },
      {
        route: "/account/support",
        userStory: marketplaceAccountBaselineStory(
          "/account/support",
          "/account/support",
          {
            id: "ACCOUNT.STORY.SUPPORT",
            actor: "Authenticated member reviewing support history",
            outcome:
              "Review account-scoped support ticket summaries with created, empty, and temporarily unavailable states without exposing ticket message contents.",
            acceptance: {
              given:
                "The route may be unauthorised or contain created-return, ticket-list, empty, or query-failure states.",
              when: "They open the Support route.",
              then: "The page redirects an unauthorised visitor and otherwise renders support summaries, safe empty guidance, or a recoverable unavailable state.",
            },
            renderAssertions: [
              'redirect("/sign-in");',
              "Support tickets",
              "No support tickets yet",
              "Support history is temporarily unavailable",
              "exposing support message contents.",
            ],
          }
        ),
      },
      {
        route: "/account/support/[id]",
        href: "/account/support/demo-support-ticket-control-room",
        noindex: true,
        userStory: marketplaceAccountBaselineStory(
          "/account/support/[id]",
          "/account/support/demo-support-ticket-control-room",
          {
            id: "ACCOUNT.STORY.SUPPORT-DETAIL",
            actor: "Authenticated owner of a support ticket",
            outcome:
              "Review one account-owned support conversation in chronological order while signed-out, missing, and other-account ticket identifiers reveal no private ticket data.",
            acceptance: {
              given:
                "A concrete ticket identifier may be missing, owned by the current account, or belong to another account.",
              when: "They open the registered Support ticket sample path.",
              then: "The page requires the current profile, performs an owner-scoped lookup, binds inaccessible identifiers to not-found, and caps the displayed message history.",
            },
            renderAssertions: [
              "const current = await requireSupportTicketProfile();",
              "const ticket = await getSupportTicketForCurrentUser(current, id);",
              "if (!ticket) notFound();",
              "Latest {SUPPORT_TICKET_MESSAGE_LIMIT} shown",
            ],
          }
        ),
      },
      {
        route: "/account/team",
        roles: ["member", "admin", "owner"],
        userStory: marketplaceAccountBaselineStory(
          "/account/team",
          "/account/team",
          {
            id: "ACCOUNT.STORY.TEAM",
            actor:
              "Authenticated organization member, team administrator, owner, or invited account",
            outcome:
              "Review organization memberships, create protected invitations when authorized, accept or reject an email-bound invitation, manage least-privilege member roles, and transfer ownership without removing the last owner.",
            acceptance: {
              given:
                "The route may be unauthorised or contain invitation, linked-team, empty, mutation-result, or query-failure states.",
              when: "They open the Team route.",
              then: "The page preserves a safe invitation return path for authentication and otherwise renders bounded team controls, explicit mutation feedback, last-owner guidance, an empty state, or a recoverable unavailable state.",
            },
            renderAssertions: [
              "redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);",
              "<TeamInvitationReview",
              "<TeamManagement organizations={organizations} />",
              "Invite members, manage least-privilege roles, and transfer ownership safely.",
              "No organizations linked",
              "Teams are temporarily unavailable",
            ],
          }
        ),
      },
      {
        route: "/account/usage",
        userStory: marketplaceAccountBaselineStory(
          "/account/usage",
          "/account/usage",
          {
            id: "ACCOUNT.STORY.USAGE",
            actor: "Signed-out visitor or authenticated member",
            outcome:
              "See a sign-in boundary or local tier limits and account-scoped usage events with explicit empty and temporarily unavailable states.",
            acceptance: {
              given:
                "The route may be signed out or opened by a member with snapshot, default, empty, populated, or query-failure usage data.",
              when: "They open the Usage route.",
              then: "The page renders sign-in guidance or local entitlement limits and recent usage with explicit empty and recoverable unavailable states.",
            },
            renderAssertions: [
              "Sign in to view usage limits",
              "These limits come from your latest local entitlement snapshot,",
              "Recent usage events",
              "Usage history is temporarily unavailable",
              "No usage events yet",
            ],
          }
        ),
      },
    ],
  },
  {
    key: "admin",
    label: "Administration",
    audience: "Moderator or administrator under least privilege",
    userStory: "As an authorised operator, I can work down live queues, review system health and perform only the audited mutations allowed by my role.",
    acceptance: [
      ...COMMON_ACCEPTANCE,
      "Moderator navigation and controls exclude administrator-only mutations.",
      "Status values are allowlisted, reasons are required and self-lockout is blocked.",
      "Sensitive failures show a safe reference and retry path without leaking internals.",
    ],
    screens: [
      {
        route: "/admin",
        userStory: adminBaselineStory("/admin", {
          id: "ADMIN.STORY.DASHBOARD",
          actor: "GreyhoundIQ administrator",
          outcome:
            "Review a role-aware command centre for live queues, platform health, membership and revenue while moderator navigation is redirected to the reports queue.",
          acceptance: {
            given:
              "The source declares this dashboard administrator-only, while request-level denial for other identities remains unverified.",
            when: "The administrator opens the Administration dashboard.",
            then:
              "Queue totals, reporting snapshots and system-health states render without exposing a moderator-only dashboard variant.",
          },
          renderAssertions: [
            "export default async function AdminPage() {",
            "const operator = await requireModeratorProfile();",
            "if (operator.profileRole !== \"admin\") redirect(\"/admin/reports\");",
            'title="Dashboard"',
          ],
        }),
      },
      {
        route: "/admin/account-deletion",
        userStory: adminBaselineStory("/admin/account-deletion", {
          id: "ADMIN.STORY.ACCOUNT-DELETION",
          actor: "GreyhoundIQ administrator reviewing deletion operations",
          outcome:
            "Review pending account-deletion requests, deletion jobs and a deliberately redacted audit trail, including explicit empty rows and bounded status controls.",
          acceptance: {
            given:
              "The source declares the account-deletion operations page administrator-only; request-level role denial is not yet proven.",
            when: "The administrator opens the account-deletion operations page.",
            then:
              "Pending requests, jobs and audit activity render with identifiers and timestamps but without email, provider, network or metadata fields.",
          },
          renderAssertions: [
            "export default async function AdminAccountDeletionPage() {",
            "await requireAdminProfile();",
            'title="Account deletion"',
            "No pending deletion requests found.",
          ],
        }),
      },
      {
        route: "/admin/actions",
        userStory: adminBaselineStory("/admin/actions", {
          id: "ADMIN.STORY.ACTIONS",
          actor: "GreyhoundIQ administrator reviewing privileged actions",
          outcome:
            "Inspect the latest local administrator-action rows with action, target, reason and timestamp context while unrelated sensitive fields remain outside the view.",
          acceptance: {
            given:
              "The source declares the privileged-action ledger administrator-only; request-level role denial remains unverified.",
            when: "The administrator opens the Actions ledger.",
            then:
              "The latest bounded action rows or an explicit empty state render using operational identifiers, reasons and timestamps.",
          },
          renderAssertions: [
            "export default async function AdminActionsPage() {",
            "const current = await requireAdminProfile();",
            'title="Actions"',
            "No admin actions found.",
          ],
        }),
      },
      {
        route: "/admin/audit",
        userStory: adminBaselineStory("/admin/audit", {
          id: "ADMIN.STORY.AUDIT",
          actor: "GreyhoundIQ administrator reviewing audit evidence",
          outcome:
            "Inspect the latest local audit rows by actor type, action, target and time while metadata, network information, payloads and actor identifiers stay undisclosed.",
          acceptance: {
            given:
              "The source declares the audit-log page administrator-only; runtime denial for lower roles is still unverified.",
            when: "The administrator opens the Audit log.",
            then:
              "A bounded audit table or explicit empty state renders without metadata, IP addresses, user agents, actor IDs or payloads.",
          },
          renderAssertions: [
            "export default async function AdminAuditLogPage() {",
            "await requireAdminProfile();",
            'title="Audit log"',
            "No audit log rows found.",
          ],
        }),
      },
      {
        route: "/admin/bespoke",
        userStory: adminBaselineStory("/admin/bespoke", {
          id: "ADMIN.STORY.BESPOKE",
          actor: "GreyhoundIQ moderator or administrator handling bespoke work",
          outcome:
            "Review paid bespoke-design requests and the allowlisted status-and-reason form that an authorised moderator may submit, without claiming that a mutation succeeded.",
          acceptance: {
            given:
              "The source declares the bespoke queue moderator-capable; request-level denial and mutation execution remain unverified.",
            when: "The moderator opens the Bespoke design requests queue.",
            then:
              "Request rows, allowed statuses, optional notes and the required audit reason control render, or an explicit empty state appears.",
          },
          renderAssertions: [
            "export default async function BespokeAdmin() {",
            "const current = await requireModeratorProfile();",
            'title="Bespoke design requests"',
            "action={updateBespokeRequestAction}",
          ],
        }),
      },
      {
        route: "/admin/billing",
        userStory: adminBaselineStory("/admin/billing", {
          id: "ADMIN.STORY.BILLING",
          actor: "GreyhoundIQ administrator reconciling billing customers",
          outcome:
            "Review a bounded set of local billing-customer records and lifecycle status controls while raw provider payloads and metadata remain excluded from the page.",
          acceptance: {
            given:
              "The source declares the billing-customer page administrator-only; request-level denial is still unverified.",
            when: "The administrator opens Billing customers.",
            then:
              "Local customer identifiers and statuses or an explicit empty state render without raw provider payloads or metadata.",
          },
          renderAssertions: [
            "export default async function AdminBillingPage() {",
            "await requireAdminProfile();",
            'title="Billing customers"',
            "No billing customers found.",
          ],
        }),
      },
      {
        route: "/admin/billing-events",
        userStory: adminBaselineStory("/admin/billing-events", {
          id: "ADMIN.STORY.BILLING-EVENTS",
          actor: "GreyhoundIQ administrator reviewing billing events",
          outcome:
            "Review recent local billing-event lifecycle rows and bounded status controls while provider event identifiers and raw payloads remain outside the operational view.",
          acceptance: {
            given:
              "The source declares billing-event operations administrator-only; runtime role denial has not yet been exercised.",
            when: "The administrator opens Billing events.",
            then:
              "Recent event rows or an explicit empty state render with local operational fields and no raw provider payload.",
          },
          renderAssertions: [
            "export default async function AdminBillingEventsPage() {",
            "await requireAdminProfile();",
            'title="Billing events"',
            "No billing events found.",
          ],
        }),
      },
      {
        route: "/admin/bug-reports",
        userStory: adminBaselineStory("/admin/bug-reports", {
          id: "ADMIN.STORY.BUG-REPORTS",
          actor: "GreyhoundIQ moderator reviewing bugs or administrator managing them",
          outcome:
            "Review recent bug-report identifiers, severity and status; moderators receive a read-only view while administrators receive the audited status-and-severity controls.",
          acceptance: {
            given:
              "The source declares moderator access and gates management controls on the administrator role; runtime denial remains unverified.",
            when: "The authorised operator opens Bug reports.",
            then:
              "Rows or an explicit empty state render, with administrator controls replaced by a read-only label for moderators.",
          },
          renderAssertions: [
            "export default async function AdminBugReportsPage() {",
            "const current = await requireModeratorProfile();",
            'const canManageReports = current.profileRole === "admin";',
            'title="Bug reports"',
          ],
        }),
      },
      {
        route: "/admin/compliance",
        userStory: adminBaselineStory("/admin/compliance", {
          id: "ADMIN.STORY.COMPLIANCE",
          actor: "GreyhoundIQ administrator reviewing compliance records",
          outcome:
            "Review read-only terms acceptance, consent-event and marketing-preference records while emails, secrets, raw tokens and provider payloads remain unselected.",
          acceptance: {
            given:
              "The source declares compliance records administrator-only; request-level denial for lower roles remains unverified.",
            when: "The administrator opens Compliance.",
            then:
              "Bounded acceptance, consent and preference tables or their empty states render without the excluded sensitive fields.",
          },
          renderAssertions: [
            "export default async function AdminCompliancePage() {",
            "const current = await requireAdminProfile();",
            'title="Compliance"',
            "Read-only terms acceptance, consent event, and marketing preference records.",
          ],
        }),
      },
      {
        route: "/admin/dog-ownership",
        userStory: adminBaselineStory("/admin/dog-ownership", {
          id: "ADMIN.STORY.DOG-OWNERSHIP",
          actor: "GreyhoundIQ moderator or administrator reviewing ownership claims",
          outcome:
            "Review pending dog-ownership claims and the approve-or-reject form with claimant-visible rejection reasons, without treating source presence as proof of a completed decision.",
          acceptance: {
            given:
              "The source declares ownership review moderator-capable; request-level denial and mutation execution remain unverified.",
            when: "The moderator opens Dog ownership claims.",
            then:
              "Pending claim details and decision controls render, or the page shows the explicit no-pending-claims state.",
          },
          renderAssertions: [
            "export default async function AdminDogOwnershipPage() {",
            "await requireModeratorProfile();",
            'title="Dog ownership claims"',
            "<AdminDogOwnershipForm",
          ],
        }),
      },
      {
        route: "/admin/entitlements",
        userStory: adminBaselineStory("/admin/entitlements", {
          id: "ADMIN.STORY.ENTITLEMENTS",
          actor: "GreyhoundIQ administrator reviewing entitlement snapshots",
          outcome:
            "Inspect bounded entitlement snapshots using identifiers, JSON byte length and top-level key counts while raw entitlement values remain deliberately undisplayed.",
          acceptance: {
            given:
              "The source declares entitlement snapshots administrator-only; request-level role denial remains unverified.",
            when: "The administrator opens Entitlement snapshots.",
            then:
              "Snapshot metadata or an explicit empty state renders without exposing the raw entitlement JSON value.",
          },
          renderAssertions: [
            "export default async function AdminEntitlementsPage() {",
            "await requireAdminProfile();",
            'title="Entitlement snapshots"',
            "Raw entitlement JSON values are not displayed",
          ],
        }),
      },
      {
        route: "/admin/exports",
        userStory: adminBaselineStory("/admin/exports", {
          id: "ADMIN.STORY.EXPORTS",
          actor: "GreyhoundIQ administrator managing export artifacts",
          outcome:
            "Review export-artifact lifecycle rows and the source-present creation and status forms while storage paths and exported object contents remain hidden.",
          acceptance: {
            given:
              "The source declares export-artifact management administrator-only; request-level denial and writes remain unverified.",
            when: "The administrator opens Export artifacts.",
            then:
              "Creation controls and bounded artifact rows or an explicit empty state render without storage paths or object contents.",
          },
          renderAssertions: [
            "export default async function AdminExportsPage() {",
            "const current = await requireAdminProfile();",
            'title="Export artifacts"',
            "<AdminExportForm",
          ],
        }),
      },
      {
        route: "/admin/feed",
        userStory: adminBaselineStory("/admin/feed", {
          id: "ADMIN.STORY.FEED",
          actor: "GreyhoundIQ moderator or administrator reviewing the public feed",
          outcome:
            "Review community topics and public posts with pinned and visibility controls available to the source-declared moderator role, without claiming a moderation write completed.",
          acceptance: {
            given:
              "The source declares feed moderation moderator-capable; request-level denial and mutation execution remain unverified.",
            when: "The moderator opens Feed moderation.",
            then:
              "Topic and post inventories, controls and explicit empty states render for the current moderation queue.",
          },
          renderAssertions: [
            "export default async function AdminFeedPage() {",
            "await requireModeratorProfile();",
            'title="Feed moderation"',
            "Manage community topics, pinned posts, and public feed visibility.",
          ],
        }),
      },
      {
        route: "/admin/feedback",
        userStory: adminBaselineStory("/admin/feedback", {
          id: "ADMIN.STORY.FEEDBACK",
          actor: "GreyhoundIQ moderator reviewing feedback or administrator managing it",
          outcome:
            "Review recent feedback identifiers, status and timestamps; moderators receive a read-only view while administrators receive audited status controls.",
          acceptance: {
            given:
              "The source declares moderator access and administrator-only management controls; runtime denial remains unverified.",
            when: "The authorised operator opens Feedback.",
            then:
              "Feedback rows or an explicit empty state render, with a read-only administrator-required label for moderators.",
          },
          renderAssertions: [
            "export default async function AdminFeedbackPage() {",
            "const current = await requireModeratorProfile();",
            'const canManageFeedback = current.profileRole === "admin";',
            'title="Feedback"',
          ],
        }),
      },
      {
        route: "/admin/invitations",
        userStory: adminBaselineStory("/admin/invitations", {
          id: "ADMIN.STORY.INVITATIONS",
          actor: "GreyhoundIQ administrator reviewing organization invitations",
          outcome:
            "Inspect recent local organization-invitation rows and bounded status controls while token hashes, email hashes and provider data remain outside the page.",
          acceptance: {
            given:
              "The source declares organization invitations administrator-only; request-level role denial remains unverified.",
            when: "The administrator opens Organization invitations.",
            then:
              "Recent invitation rows or an explicit empty state render with operational fields and no token or email hashes.",
          },
          renderAssertions: [
            "export default async function AdminOrganizationInvitationsPage() {",
            "const current = await requireAdminProfile();",
            'title="Organization invitations"',
            "Token hashes, email hashes, and provider data stay hidden",
          ],
        }),
      },
      {
        route: "/admin/invoices",
        userStory: adminBaselineStory("/admin/invoices", {
          id: "ADMIN.STORY.INVOICES",
          actor: "GreyhoundIQ administrator reconciling invoices",
          outcome:
            "Review recent local invoice records, statuses and operational controls while private provider identifiers and raw billing payloads remain undisplayed.",
          acceptance: {
            given:
              "The source declares invoice operations administrator-only; request-level denial and any write remain unverified.",
            when: "The administrator opens Invoices.",
            then:
              "Bounded invoice rows or an explicit empty state render without provider identifiers or raw payloads.",
          },
          renderAssertions: [
            "export default async function AdminInvoicesPage() {",
            "await requireAdminProfile();",
            'title="Invoices"',
            "No invoice records found.",
          ],
        }),
      },
      {
        route: "/admin/jobs",
        userStory: adminBaselineStory("/admin/jobs", {
          id: "ADMIN.STORY.JOBS",
          actor: "GreyhoundIQ administrator monitoring background work",
          outcome:
            "Review read-only status across usage outbox, events, webhooks, jobs and agent runs while raw payloads, errors and sensitive identifiers stay unselected.",
          acceptance: {
            given:
              "The source declares the operational Jobs page administrator-only; request-level role denial remains unverified.",
            when: "The administrator opens Jobs.",
            then:
              "Status summaries and recent bounded rows render without raw payloads, provider identifiers, tokens or personal network fields.",
          },
          renderAssertions: [
            "export default async function AdminJobsPage() {",
            "await requireAdminProfile();",
            'title="Jobs"',
            "Read-only local operational status across usage outbox",
          ],
        }),
      },
      {
        route: "/admin/listings",
        userStory: adminBaselineStory("/admin/listings", {
          id: "ADMIN.STORY.LISTINGS",
          actor: "GreyhoundIQ moderator or administrator reviewing listings",
          outcome:
            "Review pending and recent marketplace listings with approve, reject and remove controls plus category management, without claiming that source-present actions executed.",
          acceptance: {
            given:
              "The source declares marketplace review moderator-capable; request-level denial and mutation execution remain unverified.",
            when: "The moderator opens the Marketplace review queue.",
            then:
              "Pending and recent item states, category controls and explicit empty states render with the moderation actions.",
          },
          renderAssertions: [
            "export default async function AdminListingsPage() {",
            "await requireModeratorProfile();",
            'title="Marketplace review queue"',
            "const approveAction = approveListing.bind(null, listing.id);",
          ],
        }),
      },
      {
        route: "/admin/organizations",
        userStory: adminBaselineStory("/admin/organizations", {
          id: "ADMIN.STORY.ORGANIZATIONS",
          actor: "GreyhoundIQ administrator managing organizations",
          outcome:
            "Review local organization rows and source-present organization and invitation forms while invitation token hashes and provider secrets remain undisplayed.",
          acceptance: {
            given:
              "The source declares organization management administrator-only; request-level denial and writes remain unverified.",
            when: "The administrator opens Organizations.",
            then:
              "Organization records, forms and an explicit empty state render without token hashes or provider secrets.",
          },
          renderAssertions: [
            "export default async function AdminOrganizationsPage() {",
            "const current = await requireAdminProfile();",
            'title="Organizations"',
            "<AdminOrganizationForms",
          ],
        }),
      },
      {
        route: "/admin/page-rules",
        userStory: adminBaselineStory("/admin/page-rules", {
          id: "ADMIN.STORY.PAGE-RULES",
          actor: "GreyhoundIQ administrator reviewing fraud gates",
          outcome:
            "Review the custom-page and marketplace fraud-gate configuration, including strict defaults and audited toggle controls, without claiming that a rule change persisted.",
          acceptance: {
            given:
              "The source declares Page rules administrator-only; request-level denial and mutation execution remain unverified.",
            when: "The administrator opens Page rules.",
            then:
              "Current flag states, strict-default guidance and toggle forms render with a clear moderation-load warning.",
          },
          renderAssertions: [
            "export default async function PageRulesAdmin() {",
            "await requireAdminProfile();",
            'title="Page rules"',
            "Default is strict (all on).",
          ],
        }),
      },
      {
        route: "/admin/payments",
        userStory: adminBaselineStory("/admin/payments", {
          id: "ADMIN.STORY.PAYMENTS",
          actor: "GreyhoundIQ administrator reconciling payment records",
          outcome:
            "Review bounded local payment, refund and credit-note records for operational reconciliation without treating the read-only view as payment-provider settlement proof.",
          acceptance: {
            given:
              "The source declares Payment reconciliation administrator-only; request-level denial remains unverified.",
            when: "The administrator opens Payment reconciliation.",
            then:
              "Payment, refund and credit-note tables or explicit empty states render from local records only.",
          },
          renderAssertions: [
            "export default async function AdminPaymentsPage() {",
            "await requireAdminProfile();",
            'title="Payment reconciliation"',
            "getPaymentRecords()",
          ],
        }),
      },
      {
        route: "/admin/plans",
        userStory: adminBaselineStory("/admin/plans", {
          id: "ADMIN.STORY.PLANS",
          actor: "GreyhoundIQ administrator managing plan catalog data",
          outcome:
            "Review local plans, prices and entitlement limits with source-present catalog forms while provider identifiers remain read-only and no successful write is implied.",
          acceptance: {
            given:
              "The source declares Plans administrator-only; request-level denial and catalog mutations remain unverified.",
            when: "The administrator opens Plans.",
            then:
              "Plan catalog rows, forms and empty states render with provider IDs presented as read-only context.",
          },
          renderAssertions: [
            "export default async function AdminPlansPage() {",
            "await requireAdminProfile();",
            'title="Plans"',
            "<AdminPlanForms",
          ],
        }),
      },
      {
        route: "/admin/reports",
        userStory: adminBaselineStory("/admin/reports", {
          id: "ADMIN.STORY.REPORTS",
          actor: "GreyhoundIQ moderator or administrator resolving reports",
          outcome:
            "Review recent reports, queue totals and dismiss-or-resolve controls available to the moderator role, without claiming a content action or report mutation completed.",
          acceptance: {
            given:
              "The source declares report review moderator-capable; request-level denial and mutation execution remain unverified.",
            when: "The moderator opens Reports.",
            then:
              "Open, dismissed and resolved report context plus decision controls render, or an explicit no-reports state appears.",
          },
          renderAssertions: [
            "export default async function AdminReportsPage() {",
            "await requireModeratorProfile();",
            'title="Reports"',
            "const action = resolveReport.bind(null, reportId);",
          ],
        }),
      },
      {
        route: "/admin/retention",
        userStory: adminBaselineStory("/admin/retention", {
          id: "ADMIN.STORY.RETENTION",
          actor: "GreyhoundIQ administrator reviewing retention operations",
          outcome:
            "Review retention policies and deletion-job scheduling controls restricted to approved operational identifiers, statuses and timestamps, without claiming persistence.",
          acceptance: {
            given:
              "The source declares Retention administrator-only; request-level denial and mutations remain unverified.",
            when: "The administrator opens Retention.",
            then:
              "Policy and deletion-job records, source-present forms and explicit empty states render using bounded operational fields.",
          },
          renderAssertions: [
            "export default async function AdminRetentionPage() {",
            "const current = await requireAdminProfile();",
            'title="Retention"',
            "<AdminRetentionForms",
          ],
        }),
      },
      {
        route: "/admin/safety",
        userStory: adminBaselineStory("/admin/safety", {
          id: "ADMIN.STORY.SAFETY",
          actor: "GreyhoundIQ moderator or administrator handling safety signals",
          outcome:
            "Review banned phrases, trust-and-safety flags and moderation metrics with source-present controls restricted to moderators, without claiming a resolution completed.",
          acceptance: {
            given:
              "The source declares Moderation controls moderator-capable; request-level denial and mutations remain unverified.",
            when: "The moderator opens Moderation controls.",
            then:
              "Phrase rules, signal queues, metrics and explicit empty states render with the available moderation controls.",
          },
          renderAssertions: [
            "export default async function AdminSafetyPage() {",
            "await requireModeratorProfile();",
            'title="Moderation controls"',
            "resolveTrustSafetyFlag.bind(null, flag.id)",
          ],
        }),
      },
      {
        route: "/admin/site-content",
        userStory: adminBaselineStory("/admin/site-content", {
          id: "ADMIN.STORY.SITE-CONTENT",
          actor: "GreyhoundIQ administrator editing pricing copy",
          outcome:
            "Review the public pricing-content editor with a clear separation between marketing copy and the configured Stripe price IDs that determine the charged amount.",
          acceptance: {
            given:
              "The source declares Site content administrator-only; request-level denial and save execution remain unverified.",
            when: "The administrator opens the Pricing content editor.",
            then:
              "Plan-copy fields, yearly note and Stripe-amount notice render without implying that displayed marketing text controls payment settlement.",
          },
          renderAssertions: [
            "export default async function SiteContentAdmin() {",
            "await requireAdminProfile();",
            'title="Site content — Pricing"',
            "the amount Stripe actually charges comes from the configured price IDs",
          ],
        }),
      },
      {
        route: "/admin/source-health",
        userStory: adminBaselineStory("/admin/source-health", {
          id: "ADMIN.STORY.SOURCE-HEALTH",
          actor: "GreyhoundIQ administrator monitoring data sources",
          outcome:
            "Review local live-feed health and editable DataSourceHealth rows while the page explicitly avoids triggering provider imports or external feed calls.",
          acceptance: {
            given:
              "The source declares Source health administrator-only; request-level denial and update execution remain unverified.",
            when: "The administrator opens Source health.",
            then:
              "Local live status, source-health rows, update controls and empty states render without initiating an external import.",
          },
          renderAssertions: [
            "export default async function AdminSourceHealthPage() {",
            "const current = await requireAdminProfile();",
            'title="Source health"',
            "This page does not trigger provider imports or external feed calls.",
          ],
        }),
      },
      {
        route: "/admin/subscriptions",
        userStory: adminBaselineStory("/admin/subscriptions", {
          id: "ADMIN.STORY.SUBSCRIPTIONS",
          actor: "GreyhoundIQ administrator reviewing subscriptions",
          outcome:
            "Review recent local subscription lifecycle rows and status controls while private billing-provider identifiers and payload snapshots remain excluded.",
          acceptance: {
            given:
              "The source declares Subscriptions administrator-only; request-level denial and status writes remain unverified.",
            when: "The administrator opens Subscriptions.",
            then:
              "Bounded local subscription rows or an explicit empty state render without private provider identifiers or payload snapshots.",
          },
          renderAssertions: [
            "export default async function AdminSubscriptionsPage() {",
            "await requireAdminProfile();",
            'title="Subscriptions"',
            "Private billing-provider identifiers and payload snapshots are excluded.",
          ],
        }),
      },
      {
        route: "/admin/support",
        userStory: adminBaselineStory("/admin/support", {
          id: "ADMIN.STORY.SUPPORT",
          actor: "GreyhoundIQ moderator reviewing support or administrator managing it",
          outcome:
            "Review aggregate support-ticket counts and recent ticket rows without message contents; moderators are read-only while administrators receive reply and status controls.",
          acceptance: {
            given:
              "The source declares moderator access and administrator-only ticket management; runtime denial remains unverified.",
            when: "The authorised operator opens Support ticket counts.",
            then:
              "Counts and ticket summaries or an explicit empty state render, with administrator controls replaced for moderators.",
          },
          renderAssertions: [
            "export default async function AdminSupportPage() {",
            "const current = await requireModeratorProfile();",
            'const canManageTickets = current.profileRole === "admin";',
            'title="Support ticket counts"',
          ],
        }),
      },
      {
        route: "/admin/usage",
        userStory: adminBaselineStory("/admin/usage", {
          id: "ADMIN.STORY.USAGE",
          actor: "GreyhoundIQ administrator reviewing platform usage",
          outcome:
            "Review bounded local usage aggregates, usage events and usage-outbox rows using only approved operational fields and explicit empty-state handling.",
          acceptance: {
            given:
              "The source declares Usage administrator-only; request-level role denial remains unverified.",
            when: "The administrator opens Usage.",
            then:
              "Aggregate, event and outbox tables or explicit empty states render from the approved operational projection.",
          },
          renderAssertions: [
            "export default async function AdminUsagePage() {",
            "await requireAdminProfile();",
            'title="Usage"',
            "Aggregate rows are limited to approved operational fields.",
          ],
        }),
      },
      {
        route: "/admin/users",
        userStory: adminBaselineStory("/admin/users", {
          id: "ADMIN.STORY.USERS",
          actor: "GreyhoundIQ administrator reviewing member access",
          outcome:
            "Search and filter local user records and inspect administrator-only access controls while source registration alone does not prove request denial or a safe mutation.",
          acceptance: {
            given:
              "The source declares Users administrator-only; request-level role denial and access mutations remain unverified.",
            when: "The administrator opens Users with the default or filtered query.",
            then:
              "Bounded user rows, filters and access controls render, or the page presents an explicit no-matching-users state.",
          },
          renderAssertions: [
            "export default async function AdminUsersPage",
            "const current = await requireAdminProfile();",
            'title="Users"',
            'const canManageAccess = current.profileRole === "admin";',
          ],
        }),
      },
      {
        route: "/admin/webhooks",
        userStory: adminBaselineStory("/admin/webhooks", {
          id: "ADMIN.STORY.WEBHOOKS",
          actor: "GreyhoundIQ administrator reviewing webhook delivery",
          outcome:
            "Review recent stored webhook-event status and timing rows plus bounded status controls, without treating local receipt as proof of upstream delivery correctness.",
          acceptance: {
            given:
              "The source declares Webhook events administrator-only; request-level denial and status writes remain unverified.",
            when: "The administrator opens Webhook events.",
            then:
              "Recent event rows, status counts and an explicit empty state render from local stored records.",
          },
          renderAssertions: [
            "export default async function AdminWebhooksPage() {",
            "await requireAdminProfile();",
            'title="Webhook events"',
            "Latest 10 stored webhook events from the local database.",
          ],
        }),
      },
    ],
  },
  {
    key: "ai",
    label: "AI tools",
    audience: "Member with feature access",
    userStory: "As a member, I can understand and launch supported AI tools without exposing secrets or implying unsupported automation.",
    acceptance: [...COMMON_ACCEPTANCE, "Feature and tier gates explain the next permitted action."],
    screens: [
      {
        route: "/agents",
        userStory: aiBaselineStory({
          id: "AI.STORY.AGENT-CONSOLE",
          actor: "GreyhoundIQ member evaluating AI-assisted racing tools",
          outcome:
            "Review the supported agent lineup, follow the explicit Pro entry boundary and per-agent Pro or Pro+ requirements, and see recent-run or empty-history context without treating the rendered console as proof of role, tier, execution, cancellation, or memory isolation enforcement.",
          acceptance: {
            given:
              "The registry declares AI-tools-user or administrator access and Pro or Pro+ tiers, while request-level role and tier denial remain unverified.",
            when: "The member opens the AI Agents console.",
            then:
              "The page renders the supported agent lineup and limitations, pricing and statistics paths, the Pro execution gate with per-agent Pro or Pro+ requirements, and either bounded recent-run metadata or the explicit no-runs state.",
          },
          renderAssertions: [
            "export default async function AgentsPage() {",
            "Agent lineup",
            '<ProGate minTier="pro" feature="Live agent execution">',
            "No agent runs recorded yet.",
          ],
        }),
      },
    ],
  },
  {
    key: "design-lab",
    label: "Design Lab",
    audience: "Local or explicitly enabled reviewer",
    userStory: "As a reviewer, I can switch every Feed, dock, role and Marketplace variant and inspect the complete screen contract without production data.",
    acceptance: [
      ...COMMON_ACCEPTANCE,
      "All review routes are noindex and production-gated unless previews are explicitly enabled.",
      "Selectors preserve variant, dock, device and sponsored-demo state in the URL.",
    ],
    screens: [
      { route: "/design-lab" },
      { route: "/design-lab/demo-experience" },
      { route: "/design-lab/dock-skins" },
      { route: "/design-lab/role-blueprints" },
      { route: "/feed/device-preview" },
      { route: "/marketplace/design-lab" },
    ],
  },
] as const;

export const DEMO_ROUTE_AUDIT_EXPECTED_ROWS = DEMO_SCREEN_FAMILIES.flatMap(
  (family) =>
    family.screens.map((screen) => ({
      family: family.key,
      route: screen.route,
      samplePath: screen.href ?? screen.route,
    }))
);

export const DEMO_ROUTE_AUDIT_EVALUATION = evaluateDemoRouteAuditEvidence(
  demoRouteAuditEvidence,
  DEMO_ROUTE_AUDIT_EXPECTED_ROWS
);

const DEMO_ROUTE_AUDIT_PASSED_ROUTES = new Set(
  DEMO_ROUTE_AUDIT_EVALUATION.passedRoutes
);

const DESIGN_LAB_QUERY_PARAMETERS = [
  "route",
  "fixture",
  "role",
  "tier",
  "auth",
  "permissions",
  "device",
  "orientation",
  "theme",
  "dock",
  "state",
  "tour",
  "tourStep",
  "sponsoredDemo",
  "reducedMotion",
  "auditPrompt",
  "auditSection",
  "auditStatus",
  "auditQuery",
] as const;

const FAMILY_ACCESS: Record<
  string,
  Pick<ScreenContract, "authentication" | "roles" | "tiers" | "featureFlags">
> = {
  public: {
    authentication: "public",
    roles: ["visitor", "member"],
    tiers: ["free", "pro", "pro_plus"],
    featureFlags: [],
  },
  racing: {
    authentication: "optional",
    roles: ["visitor", "racing-member"],
    tiers: ["free", "pro", "pro_plus"],
    featureFlags: [],
  },
  community: {
    authentication: "optional",
    roles: ["visitor", "member", "community-participant", "page-manager"],
    tiers: ["free", "pro", "pro_plus"],
    featureFlags: [],
  },
  marketplace: {
    authentication: "optional",
    roles: ["visitor", "marketplace-buyer", "marketplace-seller"],
    tiers: ["free", "pro", "pro_plus"],
    featureFlags: [],
  },
  account: {
    authentication: "required",
    roles: ["member", "page-manager", "team-member"],
    tiers: ["free", "pro", "pro_plus"],
    featureFlags: [],
  },
  admin: {
    authentication: "required",
    roles: ["support-operator", "moderator", "administrator"],
    tiers: ["free", "pro", "pro_plus"],
    featureFlags: [],
  },
  ai: {
    authentication: "required",
    roles: ["ai-tools-user", "administrator"],
    tiers: ["pro", "pro_plus"],
    featureFlags: [],
  },
  "design-lab": {
    authentication: "optional",
    roles: ["reviewer", "administrator"],
    tiers: ["free", "pro", "pro_plus"],
    featureFlags: ["ENABLE_DEVICE_PREVIEWS"],
  },
};

const BASE_SCREEN_STATES = ["default"] as const;

function routeTitle(route: string) {
  if (route === "/") return "Home";
  const segments = route
    .split("/")
    .filter(Boolean)
    .filter((segment) => !segment.startsWith("["))
    .map((segment) =>
      segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    );
  const suffix = route.includes("[") ? " detail" : "";
  return `${segments.join(" / ")}${suffix}`;
}

function routeSourceFile(route: string) {
  return route === "/"
    ? "src/app/page.tsx"
    : `src/app${route}/page.tsx`;
}

function dynamicParameters(route: string) {
  return Array.from(route.matchAll(/\[+\.\.\.(\w+)\]|\[(\w+)\]/g), (match) =>
    match[1] ?? match[2]
  );
}

function coverage(
  status: ScreenContractCoverageStatus,
  ...evidence: string[]
): ScreenContractCoverage {
  return { status, evidence };
}

const DESIGN_LAB_MANIFEST_BY_ROUTE = new Map(
  DESIGN_LAB_USER_STORY_MANIFESTS.map((manifest) => [
    manifest.route,
    manifest,
  ] as const)
);

function coverageFromClaim(claim: CoverageClaim): ScreenContractCoverage {
  return coverage(
    claim.status,
    ...new Set(claim.evidence.map((reference) => reference.path))
  );
}

function coverageFromScreenUserStory(
  story: DemoScreenUserStory
): ScreenContractCoverage {
  return coverage(
    story.coverage.status,
    story.evidence.source.path,
    story.evidence.routeAudit.path,
    story.evidence.test.path
  );
}

function toScreenContract(
  family: DemoScreenFamily,
  screen: DemoScreen
): ScreenContract {
  const access = FAMILY_ACCESS[family.key];
  const sourceFile = routeSourceFile(screen.route);
  const isDesignLab = family.key === "design-lab";
  const designLabManifest = DESIGN_LAB_MANIFEST_BY_ROUTE.get(screen.route);
  const productionCoverage = isDesignLab
    ? undefined
    : productionScreenCoverage({
        screenId: `screen:${screen.route}`,
        route: screen.route,
        concreteRoute: screen.href ?? screen.route,
        sourcePath: sourceFile,
        routeAuditPassed: DEMO_ROUTE_AUDIT_PASSED_ROUTES.has(screen.route),
      });
  const stateRules =
    designLabManifest?.states ?? productionCoverage?.stateInventory ?? [];
  const routeEvidence = [
    sourceFile,
    "src/components/demo-experience-registry.test.ts",
    "output/demo-route-audit/latest.json",
  ];

  return {
    id: `screen:${screen.route}`,
    route: screen.route,
    concreteRoute: screen.href ?? screen.route,
    routePattern: screen.route.includes("[") ? screen.route : undefined,
    title: routeTitle(screen.route),
    productArea: family.label,
    description: screen.userStory?.outcome ?? family.userStory,
    actors: [screen.userStory?.actor ?? family.audience],
    authentication: screen.authentication ?? access.authentication,
    roles: [...(screen.roles ?? access.roles)],
    tiers: [...(screen.tiers ?? access.tiers)],
    featureFlags: [...access.featureFlags],
    dynamicParameters: dynamicParameters(screen.route),
    queryParameters: isDesignLab
      ? [...DESIGN_LAB_QUERY_PARAMETERS]
      : [...(productionCoverage?.queryParameters ?? [])],
    entryPoints: [
      screen.userStory?.trigger ?? "Direct URL",
      "Design Lab screen explorer",
    ],
    primaryActions:
      designLabManifest?.actions.map((action) => action.id) ??
      productionCoverage?.actionInventory.map((action) => action.id) ??
      [],
    secondaryActions: [],
    forms:
      designLabManifest?.forms.map(
        (form) => `${form.id} -> ${form.submitsTo}`
      ) ??
      productionCoverage?.formInventory.map(
        (form) => `${form.id} -> ${form.submitsTo}`
      ) ??
      [],
    permissionRules:
      designLabManifest?.permissions ??
      productionCoverage?.permissionInventory ??
      [],
    dataDependencies: [],
    stateRules,
    supportedStates:
      stateRules.length > 0
        ? stateRules.map((state) => state.id)
        : [...BASE_SCREEN_STATES],
    onboardingTourId:
      designLabManifest?.onboarding[0]?.tourId ??
      productionCoverage?.onboardingTourId,
    designLabFixtureIds:
      designLabManifest?.designLab.map((item) => item.fixtureId) ??
      (productionCoverage ? [productionCoverage.fixture.fixtureId] : []),
    noindex:
      screen.noindex ??
      (isDesignLab ||
        screen.route === "/account/appearance" ||
        screen.route === "/auth/error"),
    productionEnabled: !isDesignLab && screen.route !== "/account/appearance",
    sourceFiles: [sourceFile],
    coverage: {
      route: coverage(
        DEMO_ROUTE_AUDIT_PASSED_ROUTES.has(screen.route)
          ? "tested"
          : "captured",
        ...routeEvidence
      ),
      userStories: designLabManifest
        ? coverageFromClaim(designLabManifest.coverage.userStories)
        : screen.userStory
          ? coverageFromScreenUserStory(screen.userStory)
          : coverage("captured", "src/components/demo-experience-registry.ts"),
      actions: designLabManifest
        ? coverageFromClaim(designLabManifest.coverage.actions)
        : productionCoverage?.actions
          ? coverageFromClaim(productionCoverage.actions)
          : coverage("not-started"),
      forms: designLabManifest
        ? coverageFromClaim(designLabManifest.coverage.forms)
        : productionCoverage?.forms
          ? coverageFromClaim(productionCoverage.forms)
          : coverage("not-started"),
      permissions: designLabManifest
        ? coverageFromClaim(designLabManifest.coverage.permissions)
        : productionCoverage?.permissions
          ? coverageFromClaim(productionCoverage.permissions)
          : coverage("captured", "src/components/demo-experience-registry.ts"),
      states: designLabManifest
        ? coverageFromClaim(designLabManifest.coverage.states)
        : productionCoverage?.states
          ? coverageFromClaim(productionCoverage.states)
          : coverage("captured", "docs/design-lab-screen-registry.md"),
      designLab: designLabManifest
        ? coverageFromClaim(designLabManifest.coverage.designLab)
        : productionCoverage
          ? coverageFromClaim(productionCoverage.designLab)
          : coverage("captured", "src/components/demo-experience-screen-map.tsx"),
      onboarding: designLabManifest
        ? coverageFromClaim(designLabManifest.coverage.onboarding)
        : productionCoverage?.onboarding
          ? coverageFromClaim(productionCoverage.onboarding)
          : coverage("not-started"),
      tests: designLabManifest
        ? coverageFromClaim(designLabManifest.coverage.tests)
        : screen.userStory
          ? coverage(
              screen.userStory.coverage.status,
              screen.userStory.evidence.test.path,
              screen.userStory.evidence.source.path,
              screen.userStory.evidence.routeAudit.path
            )
          : coverage(
              "captured",
              "src/components/demo-experience-registry.test.ts",
              "output/demo-route-audit/latest.json"
            ),
    },
  };
}

export const SCREEN_CONTRACTS: readonly ScreenContract[] =
  DEMO_SCREEN_FAMILIES.flatMap((family) =>
    family.screens.map((screen) => toScreenContract(family, screen))
  );

export const SCREEN_CONTRACT_BY_ROUTE = new Map(
  SCREEN_CONTRACTS.map((screen) => [screen.route, screen] as const)
);

export const SCREEN_CONTRACT_CHECKLIST = SCREEN_CONTRACT_COVERAGE_AREAS.map(
  (area) => {
    const statuses = SCREEN_CONTRACTS.map(
      (screen) => screen.coverage[area].status
    );
    const completed = statuses.filter(
      (status) => status === "verified" || status === "tested" || status === "excluded"
    ).length;
    const captured = statuses.filter((status) => status === "captured").length;
    const blocked = statuses.filter((status) => status === "blocked").length;
    return {
      area,
      total: SCREEN_CONTRACTS.length,
      completed,
      captured,
      blocked,
      remaining: SCREEN_CONTRACTS.length - completed - blocked,
    };
  }
);

export const DEMO_SCREEN_COUNT = SCREEN_CONTRACTS.length;

export const DEMO_USER_JOURNEYS = [
  "Visitor explores home, racing, pricing, responsible use, legal pages and contact",
  "Visitor signs in and safely returns to the intended internal page",
  "Racing member searches and filters, opens race, runner and track, then returns with context",
  "Member searches the community and opens a permitted public profile",
  "Member creates a Feed post, reacts, comments, saves and shares",
  "Member joins a group and participates in a thread",
  "Member starts a Pulse conversation and sends supported rich media",
  "Member starts and completes or safely exits a voice or video call",
  "Buyer filters Marketplace, opens and saves a listing, then sends an enquiry",
  "Seller creates, validates, previews and publishes a listing",
  "Seller edits or archives only their own listing",
  "Member updates profile, privacy, notifications and security settings",
  "Member reviews billing and safely returns from checkout",
  "Team owner invites a member and safely manages their role",
  "Moderator processes an allowed queue item",
  "Moderator is denied an administrator-only mutation",
  "Administrator performs an audited mutation with a required reason",
  "AI-tools user launches a tool and sees running, completed and failure states",
  "New user completes first-run onboarding",
  "Existing user restarts a contextual product-area tour",
  "Mobile user completes onboarding without clipping, overflow or blocked controls",
  "Reviewer reproduces every journey in Design Lab without production mutations",
] as const;
