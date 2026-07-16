import type { FamilyScreenManifest, NonEmpty } from "./types";

export const SCREEN_STATE_EVIDENCE_TEST = {
  id: "SCREEN-STATE-EVIDENCE",
  path: "src/components/screen-contracts/screen-state-evidence.test.ts",
} as const satisfies FamilyScreenManifest["tests"][number];

const TEST_IDS = [SCREEN_STATE_EVIDENCE_TEST.id] as const;

type SourceAssertion = {
  sourcePath: string;
  orderedText: NonEmpty<string>;
};

type ScreenStateWithEvidence = FamilyScreenManifest["states"][number] & {
  sourceAssertions: NonEmpty<SourceAssertion>;
};

type ScreenStateEvidenceContract = {
  route: string;
  sourcePath: string;
  states: NonEmpty<ScreenStateWithEvidence>;
};

function state(
  id: string,
  sourcePath: string,
  orderedText: NonEmpty<string>,
  options: {
    recoveryActionId?: string;
    additionalAssertions?: readonly SourceAssertion[];
  } = {},
): ScreenStateWithEvidence {
  return {
    id,
    testIds: TEST_IDS,
    ...(options.recoveryActionId
      ? { recoveryActionId: options.recoveryActionId }
      : {}),
    sourceAssertions: [
      { sourcePath, orderedText },
      ...(options.additionalAssertions ?? []),
    ],
  };
}

const GLOBAL_NOT_FOUND_ASSERTION = {
  sourcePath: "src/app/not-found.tsx",
  orderedText: [
    "export default function NotFound()",
    "Off-track.",
    'href="/"',
    "Back to home",
  ],
} as const satisfies SourceAssertion;

export const PRODUCTION_SCREEN_STATE_CONTRACTS = [
  {
    route: "/",
    sourcePath: "src/app/page.tsx",
    states: [
      state("PRODUCTION.STATE.HOME.LOADING", "src/app/page.tsx", [
        "<Suspense fallback={<TodaysRacesFallback />}>",
        "<TodaysRacesSection />",
        "<SkeletonGroup label=\"Loading today's races\">",
      ]),
      state("PRODUCTION.STATE.HOME.EMPTY", "src/app/page.tsx", [
        "meetings.length === 0 ? (",
        "No meetings are available for this race day yet.",
      ]),
      state("PRODUCTION.STATE.HOME.POPULATED", "src/app/page.tsx", [
        "meetings.length === 0 ? (",
        "{meetings.map((m) => (",
        "<MeetingCard key={m.id} meeting={m} />",
      ]),
      state(
        "PRODUCTION.STATE.HOME.RECOVERABLE-ERROR",
        "src/app/error.tsx",
        [
          "export default function Error({",
          "Something went wrong rendering this page. Try again, or contact",
          "onClick={reset}",
          "Try again",
        ],
        { recoveryActionId: "HOME.ACTION.RETRY" },
      ),
    ],
  },
  {
    route: "/pricing",
    sourcePath: "src/app/pricing/page.tsx",
    states: [
      state("PRODUCTION.STATE.PRICING.POPULATED", "src/app/pricing/page.tsx", [
        "{plans.map((plan) => {",
        "{plan.features.map((f) => (",
      ]),
      state("PRODUCTION.STATE.PRICING.DISABLED", "src/app/pricing/page.tsx", [
        "plan.id === \"pro_plus\" ? (",
        "<button",
        "disabled",
        "{plan.cta}",
      ]),
      state(
        "PRODUCTION.STATE.PRICING.CHECKOUT-SUCCESS",
        "src/app/pricing/page.tsx",
        ["if (checkout === \"success\")", "Returned from Stripe Checkout"],
      ),
      state(
        "PRODUCTION.STATE.PRICING.CHECKOUT-CANCELLED",
        "src/app/pricing/page.tsx",
        [
          "if (checkout === \"cancelled\")",
          "Checkout cancelled — no plan change was made",
        ],
      ),
      state(
        "PRODUCTION.STATE.PRICING.BILLING-FIRST-USE",
        "src/app/pricing/page.tsx",
        ["if (billing === \"not_started\")", "No Stripe billing profile yet"],
      ),
    ],
  },
  {
    route: "/races",
    sourcePath: "src/app/races/page.tsx",
    states: [
      state("PRODUCTION.STATE.RACES.LOADING", "src/app/races/loading.tsx", [
        "export default function Loading()",
        "<SkeletonGroup label=\"Loading race cards\">",
      ]),
      state("PRODUCTION.STATE.RACES.EMPTY", "src/app/races/page.tsx", [
        "const hasMeetings = data.meetings.length > 0;",
        "{hasMeetings ? (",
        "No races match these filters. Try a broader search, a recent",
      ]),
      state("PRODUCTION.STATE.RACES.POPULATED", "src/app/races/page.tsx", [
        "const hasMeetings = data.meetings.length > 0;",
        "{hasMeetings ? (",
        "{data.meetings.map((meeting) => (",
      ]),
      state(
        "PRODUCTION.STATE.RACES.RECOVERABLE-ERROR",
        "src/app/races/error.tsx",
        [
          "export default function RacesError({",
          "Race data unavailable",
          "onClick={reset}",
          "Try again",
          "href=\"/races\"",
          "Search races",
        ],
        { recoveryActionId: "RACES.ACTION.RETRY" },
      ),
    ],
  },
  {
    route: "/races/[id]",
    sourcePath: "src/app/races/[id]/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.RACE-DETAIL.LOADING",
        "src/app/races/[id]/loading.tsx",
        [
          "export default function Loading()",
          "<SkeletonGroup label=\"Loading race details\">",
        ],
      ),
      state(
        "PRODUCTION.STATE.RACE-DETAIL.MISSING",
        "src/app/races/[id]/page.tsx",
        ["const race = await getRaceById(id);", "if (!race) notFound();"],
        {
          recoveryActionId: "RACES.ACTION.SEARCH",
          additionalAssertions: [
            {
              sourcePath: "src/app/races/[id]/not-found.tsx",
              orderedText: [
                "export default function RaceNotFound()",
                "Race not found",
                "href=\"/races\"",
                "Search races",
              ],
            },
          ],
        },
      ),
      state(
        "PRODUCTION.STATE.RACE-DETAIL.EMPTY-RUNNERS",
        "src/app/races/[id]/page.tsx",
        [
          "race.runners.length === 0 && (",
          "No runners loaded for this race yet.",
        ],
      ),
      state(
        "PRODUCTION.STATE.RACE-DETAIL.POPULATED",
        "src/app/races/[id]/page.tsx",
        [
          "const orderedRunners = orderRunners(",
          "{orderedRunners.map((runner) => (",
          "<RunnerRow",
        ],
      ),
      state(
        "PRODUCTION.STATE.RACE-DETAIL.RECOVERABLE-ERROR",
        "src/app/races/error.tsx",
        [
          "export default function RacesError({",
          "Race data unavailable",
          "onClick={reset}",
          "Try again",
        ],
        { recoveryActionId: "RACES.ACTION.RETRY" },
      ),
    ],
  },
  {
    route: "/meetings/[id]",
    sourcePath: "src/app/meetings/[id]/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.MEETING-DETAIL.LOADING",
        "src/app/meetings/[id]/loading.tsx",
        [
          "export default function Loading()",
          '<SkeletonGroup label="Loading meeting details">',
          '<h1 className="sr-only">Meeting details</h1>',
        ],
      ),
      state(
        "PRODUCTION.STATE.MEETING-DETAIL.MISSING",
        "src/app/meetings/[id]/page.tsx",
        ["const meeting = await getMeetingById(id);", "if (!meeting) notFound();"],
        {
          recoveryActionId: "RACES.ACTION.SEARCH",
          additionalAssertions: [
            {
              sourcePath: "src/app/meetings/[id]/not-found.tsx",
              orderedText: [
                "export default function MeetingNotFound()",
                "Meeting not found",
                'href="/races"',
                "Search race meetings",
              ],
            },
          ],
        },
      ),
      state(
        "PRODUCTION.STATE.MEETING-DETAIL.EMPTY-RACES",
        "src/app/meetings/[id]/page.tsx",
        [
          "racePresentations.length > 0 ? (",
          "No race rows are available for this stored meeting.",
        ],
      ),
      state(
        "PRODUCTION.STATE.MEETING-DETAIL.POPULATED",
        "src/app/meetings/[id]/page.tsx",
        [
          "racePresentations.length > 0 ? (",
          "racePresentations.map(({ race, presentation }) => (",
          "<MeetingDetailRaceCard",
        ],
      ),
    ],
  },
  {
    route: "/results",
    sourcePath: "src/app/results/page.tsx",
    states: [
      state("PRODUCTION.STATE.RESULTS.LOADING", "src/app/results/loading.tsx", [
        "export default function Loading()",
        "<SkeletonGroup label=\"Loading race results\">",
      ]),
      state("PRODUCTION.STATE.RESULTS.EMPTY", "src/app/results/page.tsx", [
        "{displayResults.length > 0 ? (",
        "No settled race results are available yet.",
      ]),
      state("PRODUCTION.STATE.RESULTS.POPULATED", "src/app/results/page.tsx", [
        "{displayResults.length > 0 ? (",
        "{displayResults.map((race) => (",
        "<ResultRaceCard key={race.id} race={race} />",
      ]),
    ],
  },
  {
    route: "/tracks",
    sourcePath: "src/app/tracks/page.tsx",
    states: [
      state("PRODUCTION.STATE.TRACKS.LOADING", "src/app/tracks/loading.tsx", [
        "export default function Loading()",
        "<SkeletonGroup label=\"Loading tracks\">",
      ]),
      state("PRODUCTION.STATE.TRACKS.EMPTY", "src/app/tracks/page.tsx", [
        "{displayTracks.length > 0 ? (",
        "No tracks match this state filter.",
      ]),
      state("PRODUCTION.STATE.TRACKS.POPULATED", "src/app/tracks/page.tsx", [
        "{displayTracks.length > 0 ? (",
        "{displayTracks.map((track) => (",
        "<TrackVenueCard key={track.id} track={track} />",
      ]),
    ],
  },
  {
    route: "/tracks/[id]",
    sourcePath: "src/app/tracks/[id]/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.TRACK-DETAIL.LOADING",
        "src/app/tracks/[id]/loading.tsx",
        [
          "export default function Loading()",
          "<SkeletonGroup label=\"Loading track guide\">",
        ],
      ),
      state(
        "PRODUCTION.STATE.TRACK-DETAIL.MISSING",
        "src/app/tracks/[id]/page.tsx",
        ["const track = await getTrackById(id);", "if (!track) notFound();"],
        {
          additionalAssertions: [
            {
              sourcePath: "src/app/not-found.tsx",
              orderedText: [
                "export default function NotFound()",
                "Off-track.",
                "href=\"/\"",
                "Back to home",
              ],
            },
          ],
        },
      ),
      state(
        "PRODUCTION.STATE.TRACK-DETAIL.EMPTY-RESULTS",
        "src/app/tracks/[id]/page.tsx",
        ["{bestRun ? (", "No completed races in the current seed window."],
      ),
      state(
        "PRODUCTION.STATE.TRACK-DETAIL.POPULATED",
        "src/app/tracks/[id]/page.tsx",
        ["const bestRun = completed", "{bestRun ? (", "{bestRun.dog.name}"],
      ),
    ],
  },
  {
    route: "/discover",
    sourcePath: "src/app/discover/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.DISCOVER.LOADING",
        "src/app/discover/loading.tsx",
        [
          "export default function Loading()",
          "<SkeletonGroup label=\"Loading community discovery\">",
        ],
      ),
      state(
        "PRODUCTION.STATE.DISCOVER.FIRST-USE",
        "src/app/discover/page.tsx",
        [
          "{results.query.length < 2 ? (",
          "Search the community",
          "Enter at least two characters",
        ],
      ),
      state(
        "PRODUCTION.STATE.DISCOVER.NO-MATCHES",
        "src/app/discover/page.tsx",
        [") : shownResults === 0 ? (", "No matches for"],
      ),
      state(
        "PRODUCTION.STATE.DISCOVER.POPULATED",
        "src/app/discover/page.tsx",
        [
          ") : shownResults === 0 ? (",
          "Results for",
          "{groups.map(([label, items]) => (",
        ],
      ),
    ],
  },
  {
    route: "/forum",
    sourcePath: "src/app/forum/page.tsx",
    states: [
      state("PRODUCTION.STATE.FORUM.LOADING", "src/app/forum/loading.tsx", [
        "export default function Loading()",
        "<SkeletonGroup label=\"Loading groups\">",
      ]),
      state("PRODUCTION.STATE.FORUM.EMPTY-GROUPS", "src/app/forum/page.tsx", [
        "{categories.length ? (",
        "No community groups yet",
      ]),
      state("PRODUCTION.STATE.FORUM.EMPTY-THREADS", "src/app/forum/page.tsx", [
        "{category.threads.length ? (",
        "No threads in this group yet.",
      ]),
      state("PRODUCTION.STATE.FORUM.POPULATED", "src/app/forum/page.tsx", [
        "{categories.length ? (",
        "{categories.map((category) => (",
        "{category.threads.map((thread) => (",
      ]),
    ],
  },
  {
    route: "/messages",
    sourcePath: "src/app/messages/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.MESSAGES.LOADING",
        "src/app/messages/loading.tsx",
        [
          "export default function Loading()",
          "<SkeletonGroup label=\"Loading Pulse\">",
        ],
      ),
      state(
        "PRODUCTION.STATE.MESSAGES.SIGNED-OUT",
        "src/app/messages/page.tsx",
        ["{!user ? (", "Sign in to open Pulse", "href=\"/sign-in\""],
      ),
      state("PRODUCTION.STATE.MESSAGES.EMPTY", "src/app/messages/page.tsx", [
        "{conversations.length === 0 ? (",
        "No conversations yet",
      ]),
      state(
        "PRODUCTION.STATE.MESSAGES.POPULATED",
        "src/app/messages/page.tsx",
        [
          "{conversations.length === 0 ? (",
          "{conversations.map((conversation) => {",
        ],
      ),
      state(
        "PRODUCTION.STATE.MESSAGES.RECOVERABLE-ERROR",
        "src/app/messages/error.tsx",
        [
          "export default function MessagesError({",
          "PULSE UNAVAILABLE",
          "onClick={reset}",
          "Try again",
        ],
        { recoveryActionId: "MESSAGES.ACTION.RETRY" },
      ),
    ],
  },
  {
    route: "/about",
    sourcePath: "src/app/about/page.tsx",
    states: [
      state("PRODUCTION.STATE.ABOUT.POPULATED", "src/app/about/page.tsx", [
        "export default function AboutPage()",
        "What we believe",
        "{VALUES.map((v) => {",
        "Contact us",
      ]),
    ],
  },
  {
    route: "/auth/error",
    sourcePath: "src/app/auth/error/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.AUTH-ERROR.RECOVERY",
        "src/app/auth/error/page.tsx",
        [
          "const reason = parseAuthCallbackFailureReason(params.reason);",
          "const copy = AUTH_CALLBACK_RECOVERY_COPY[reason];",
          "{copy.title}",
          "Try sign-in again",
        ],
      ),
      state(
        "PRODUCTION.STATE.AUTH-ERROR.REFERENCE",
        "src/app/auth/error/page.tsx",
        ["{reference ? (", "Support reference:", "{reference}"],
      ),
    ],
  },
  {
    route: "/contact",
    sourcePath: "src/app/contact/page.tsx",
    states: [
      state("PRODUCTION.STATE.CONTACT.SIGNED-OUT", "src/app/contact/page.tsx", [
        "{user ? (",
        ") : (",
        "Sign in to create a ticket",
        'href="/sign-in"',
      ]),
      state("PRODUCTION.STATE.CONTACT.SIGNED-IN", "src/app/contact/page.tsx", [
        "{user ? (",
        "<form action={createSupportTicket}",
        "Send request",
      ]),
      state("PRODUCTION.STATE.CONTACT.TICKET-CREATED", "src/app/contact/page.tsx", [
        "{ticketCreated && (",
        "Your support request has been sent.",
      ]),
    ],
  },
  {
    route: "/privacy",
    sourcePath: "src/app/privacy/page.tsx",
    states: [
      state("PRODUCTION.STATE.PRIVACY.POPULATED", "src/app/privacy/page.tsx", [
        "export default function PrivacyPage()",
        "Privacy Policy",
        "<CookiePreferencePanel />",
      ]),
    ],
  },
  {
    route: "/responsible-use",
    sourcePath: "src/app/responsible-use/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.RESPONSIBLE-USE.POPULATED",
        "src/app/responsible-use/page.tsx",
        [
          "export default function ResponsibleUsePage()",
          "Responsible use",
          "{PRINCIPLES.map(({ icon: Icon, title, body }) => (",
          "Support is available",
        ],
      ),
    ],
  },
  {
    route: "/terms",
    sourcePath: "src/app/terms/page.tsx",
    states: [
      state("PRODUCTION.STATE.TERMS.POPULATED", "src/app/terms/page.tsx", [
        "export default function TermsPage()",
        "Terms of Service",
        "By using GreyhoundIQ you agree to these terms.",
        "Contact us",
      ]),
    ],
  },
  {
    route: "/breeding",
    sourcePath: "src/app/breeding/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.BREEDING.LOADING",
        "src/app/breeding/loading.tsx",
        [
          "export default function Loading()",
          '<SkeletonGroup label="Loading breeding analytics">',
        ],
      ),
      state("PRODUCTION.STATE.BREEDING.POPULATED", "src/app/breeding/page.tsx", [
        "const SIRE_LEADERS = (await getSireLeaderboard(8)).map((s) => ({",
        "{FEATURES.map((f) => {",
        "{SIRE_LEADERS.map((s, i) => (",
      ]),
    ],
  },
  {
    route: "/dogs",
    sourcePath: "src/app/dogs/page.tsx",
    states: [
      state("PRODUCTION.STATE.DOGS.DIRECTORY", "src/app/dogs/page.tsx", [
        "const tallies = await getDogSearchTallies();",
        "<DogSearch initialQuery={initialQuery} />",
        "{stats.map((stat) => (",
      ]),
    ],
  },
  {
    route: "/dogs/[id]",
    sourcePath: "src/app/dogs/[id]/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.DOG-DETAIL.LOADING",
        "src/app/dogs/[id]/loading.tsx",
        [
          "export default function Loading()",
          '<SkeletonGroup label="Loading dog profile"',
        ],
      ),
      state(
        "PRODUCTION.STATE.DOG-DETAIL.MISSING",
        "src/app/dogs/[id]/page.tsx",
        ["const dog = await getDogById(id);", "if (!dog) notFound();"],
        { additionalAssertions: [GLOBAL_NOT_FOUND_ASSERTION] },
      ),
      state(
        "PRODUCTION.STATE.DOG-DETAIL.EMPTY-OWNERSHIP",
        "src/app/dogs/[id]/page.tsx",
        [
          "{approvedOwnership.length > 0 ? (",
          "No verified profile is linked to this dog yet.",
        ],
      ),
      state(
        "PRODUCTION.STATE.DOG-DETAIL.POPULATED",
        "src/app/dogs/[id]/page.tsx",
        [
          "const recentForm = buildRecentForm(dog);",
          "{dog.name}",
          "{recentForm.map((entry) => (",
        ],
      ),
    ],
  },
  {
    route: "/statistics",
    sourcePath: "src/app/statistics/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.STATISTICS.LOADING",
        "src/app/statistics/loading.tsx",
        [
          "export default function Loading()",
          '<SkeletonGroup label="Loading statistics">',
        ],
      ),
      state(
        "PRODUCTION.STATE.STATISTICS.POPULATED",
        "src/app/statistics/page.tsx",
        [
          "const BOX_BIAS = buildBoxBiasPresentation(boxBiasRows).map((b) => ({",
          "{BOX_BIAS.map((b) => (",
          "{TRAINER_LEADERS.map((t, i) => {",
          "{TRACK_RECORDS.map((r) => (",
        ],
      ),
    ],
  },
  {
    route: "/feed",
    sourcePath: "src/app/feed/page.tsx",
    states: [
      state("PRODUCTION.STATE.FEED.LOADING", "src/app/feed/loading.tsx", [
        "export default function FeedLoading()",
        "<SkeletonGroup",
        'label="Loading your feed"',
      ]),
      state("PRODUCTION.STATE.FEED.SIGNED-OUT", "src/app/feed/page.tsx", [
        "if (!user?.dbUserId || !user.profileId)",
        "getFeedPageForViewer({ mode, limit: 20, current: null })",
        "signedIn={false}",
      ]),
      state("PRODUCTION.STATE.FEED.SIGNED-IN", "src/app/feed/page.tsx", [
        "const current = {",
        "const activeActor = activePage",
        "await runFeedReadTasks([",
        'aria-label="Community feed"',
      ]),
    ],
  },
  {
    route: "/forum/[slug]",
    sourcePath: "src/app/forum/[slug]/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.FORUM-CATEGORY.MISSING",
        "src/app/forum/[slug]/page.tsx",
        ["getForumCategoryBySlug(slug)", "if (!category) notFound();"],
        { additionalAssertions: [GLOBAL_NOT_FOUND_ASSERTION] },
      ),
      state(
        "PRODUCTION.STATE.FORUM-CATEGORY.EMPTY",
        "src/app/forum/[slug]/page.tsx",
        ["{category.threads.length === 0 ? (", "No group threads here yet."],
      ),
      state(
        "PRODUCTION.STATE.FORUM-CATEGORY.POPULATED",
        "src/app/forum/[slug]/page.tsx",
        [
          "{category.threads.length === 0 ? (",
          "category.threads.map((thread) => {",
        ],
      ),
      state(
        "PRODUCTION.STATE.FORUM-CATEGORY.SIGNED-OUT",
        "src/app/forum/[slug]/page.tsx",
        ["{user ? (", ") : (", "Public browsing stays open.", 'href="/sign-in"'],
      ),
    ],
  },
  {
    route: "/forum/threads/[id]",
    sourcePath: "src/app/forum/threads/[id]/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.FORUM-THREAD.MISSING",
        "src/app/forum/threads/[id]/page.tsx",
        ["getForumThreadById(id)", "if (!thread) notFound();"],
        { additionalAssertions: [GLOBAL_NOT_FOUND_ASSERTION] },
      ),
      state(
        "PRODUCTION.STATE.FORUM-THREAD.POPULATED",
        "src/app/forum/threads/[id]/page.tsx",
        ["{thread.posts.map((post, index) => (", "{post.body}"],
      ),
      state(
        "PRODUCTION.STATE.FORUM-THREAD.LOCKED",
        "src/app/forum/threads/[id]/page.tsx",
        ["{thread.locked ? (", "This thread is locked."],
      ),
      state(
        "PRODUCTION.STATE.FORUM-THREAD.SIGNED-OUT",
        "src/app/forum/threads/[id]/page.tsx",
        [") : user ? (", ") : (", "Sign in to reply to this thread."],
      ),
    ],
  },
  {
    route: "/groups",
    sourcePath: "src/app/groups/page.tsx",
    states: [
      state("PRODUCTION.STATE.GROUPS.EMPTY-GROUPS", "src/app/forum/page.tsx", [
        "{categories.length ? (",
        "No community groups yet",
      ]),
      state("PRODUCTION.STATE.GROUPS.EMPTY-THREADS", "src/app/forum/page.tsx", [
        "{category.threads.length ? (",
        "No threads in this group yet.",
      ]),
      state("PRODUCTION.STATE.GROUPS.POPULATED", "src/app/forum/page.tsx", [
        "{categories.length ? (",
        "{categories.map((category) => (",
        "{category.threads.map((thread) => (",
      ]),
    ],
  },
  {
    route: "/groups/[slug]",
    sourcePath: "src/app/groups/[slug]/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.GROUP-DETAIL.MISSING",
        "src/app/forum/[slug]/page.tsx",
        ["getForumCategoryBySlug(slug)", "if (!category) notFound();"],
        { additionalAssertions: [GLOBAL_NOT_FOUND_ASSERTION] },
      ),
      state(
        "PRODUCTION.STATE.GROUP-DETAIL.EMPTY",
        "src/app/forum/[slug]/page.tsx",
        ["{category.threads.length === 0 ? (", "No group threads here yet."],
      ),
      state(
        "PRODUCTION.STATE.GROUP-DETAIL.POPULATED",
        "src/app/forum/[slug]/page.tsx",
        [
          "{category.threads.length === 0 ? (",
          "category.threads.map((thread) => {",
        ],
      ),
      state(
        "PRODUCTION.STATE.GROUP-DETAIL.SIGNED-OUT",
        "src/app/forum/[slug]/page.tsx",
        ["{user ? (", ") : (", "Public browsing stays open.", 'href="/sign-in"'],
      ),
    ],
  },
  {
    route: "/groups/threads/[id]",
    sourcePath: "src/app/groups/threads/[id]/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.GROUP-THREAD.MISSING",
        "src/app/forum/threads/[id]/page.tsx",
        ["getForumThreadById(id)", "if (!thread) notFound();"],
        { additionalAssertions: [GLOBAL_NOT_FOUND_ASSERTION] },
      ),
      state(
        "PRODUCTION.STATE.GROUP-THREAD.POPULATED",
        "src/app/forum/threads/[id]/page.tsx",
        ["{thread.posts.map((post, index) => (", "{post.body}"],
      ),
      state(
        "PRODUCTION.STATE.GROUP-THREAD.LOCKED",
        "src/app/forum/threads/[id]/page.tsx",
        ["{thread.locked ? (", "This thread is locked."],
      ),
      state(
        "PRODUCTION.STATE.GROUP-THREAD.SIGNED-OUT",
        "src/app/forum/threads/[id]/page.tsx",
        [") : user ? (", ") : (", "Sign in to reply to this thread."],
      ),
    ],
  },
  {
    route: "/p/[handle]",
    sourcePath: "src/app/p/[handle]/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.PUBLIC-PROFILE.MISSING",
        "src/app/p/[handle]/page.tsx",
        [
          "const profile = await getSocialActorProfileByHandle(handle, viewer);",
          "if (!profile) notFound();",
        ],
        { additionalAssertions: [GLOBAL_NOT_FOUND_ASSERTION] },
      ),
      state(
        "PRODUCTION.STATE.PUBLIC-PROFILE.PERSONAL",
        "src/app/p/[handle]/page.tsx",
        [
          'if (profile.actor.kind === "personal")',
          "<PersonalProfileView",
        ],
      ),
      state(
        "PRODUCTION.STATE.PUBLIC-PROFILE.MANAGED-PAGE",
        "src/app/p/[handle]/page.tsx",
        [
          "const page = await getPublishedCustomPageByHandle(profile.actor.handle);",
          "<ManagedPageView",
        ],
      ),
      state(
        "PRODUCTION.STATE.PUBLIC-PROFILE.EMPTY-TIMELINE",
        "src/app/p/[handle]/page.tsx",
        ["{profile.timeline.length > 0 ? (", "No posts are visible to you yet."],
      ),
    ],
  },
  {
    route: "/listings",
    sourcePath: "src/app/listings/page.tsx",
    states: [
      state("PRODUCTION.STATE.LISTINGS.LOADING", "src/app/listings/page.tsx", [
        '<Suspense fallback={<ListingsFallback q="" />}>',
        '<SkeletonGroup label="Loading marketplace">',
      ]),
      state("PRODUCTION.STATE.LISTINGS.SIGNED-OUT", "src/app/listings/page.tsx", [
        "const signedIn = Boolean(user);",
        "{signedIn ? <MarketplaceMemberHeader /> : <MarketplaceMarketingHero />}",
      ]),
      state("PRODUCTION.STATE.LISTINGS.EMPTY", "src/app/listings/page.tsx", [
        "{listings.length === 0 ? (",
        "No marketplace items yet",
      ]),
      state("PRODUCTION.STATE.LISTINGS.POPULATED", "src/app/listings/page.tsx", [
        "{listings.length === 0 ? (",
        "{listings.map((listing) =>",
      ]),
    ],
  },
  {
    route: "/listings/[id]",
    sourcePath: "src/app/listings/[id]/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.LISTING-DETAIL.MISSING",
        "src/app/listings/[id]/page.tsx",
        ["getListingForViewerById(id, user)", "catch {", "notFound();"],
        { additionalAssertions: [GLOBAL_NOT_FOUND_ASSERTION] },
      ),
      state(
        "PRODUCTION.STATE.LISTING-DETAIL.EMPTY-MEDIA",
        "src/app/listings/[id]/page.tsx",
        ["{listing.media.length > 0 ? (", "No media attached"],
      ),
      state(
        "PRODUCTION.STATE.LISTING-DETAIL.POPULATED",
        "src/app/listings/[id]/page.tsx",
        ["{listing.title}", "{formatPrice(listing.price, listing.currency)}"],
      ),
    ],
  },
  {
    route: "/listings/new",
    sourcePath: "src/app/listings/new/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.LISTING-CREATE.SIGNED-OUT",
        "src/app/listings/new/page.tsx",
        ["{canCreateListing ? (", "{user ? (", "Sign in to create marketplace items"],
      ),
      state(
        "PRODUCTION.STATE.LISTING-CREATE.TIER-BLOCKED",
        "src/app/listings/new/page.tsx",
        ["{canCreateListing ? (", "{user ? (", "Upgrade to create marketplace items"],
      ),
      state(
        "PRODUCTION.STATE.LISTING-CREATE.EDITOR",
        "src/app/listings/new/page.tsx",
        ["{canCreateListing ? (", "<form", "action={createListing}"],
      ),
    ],
  },
  {
    route: "/marketplace",
    sourcePath: "src/app/marketplace/page.tsx",
    states: [
      state("PRODUCTION.STATE.MARKETPLACE.LOADING", "src/app/listings/page.tsx", [
        '<Suspense fallback={<ListingsFallback q="" />}>',
        '<SkeletonGroup label="Loading marketplace">',
      ]),
      state("PRODUCTION.STATE.MARKETPLACE.SIGNED-OUT", "src/app/listings/page.tsx", [
        "const signedIn = Boolean(user);",
        "{signedIn ? <MarketplaceMemberHeader /> : <MarketplaceMarketingHero />}",
      ]),
      state("PRODUCTION.STATE.MARKETPLACE.EMPTY", "src/app/listings/page.tsx", [
        "{listings.length === 0 ? (",
        "No marketplace items yet",
      ]),
      state("PRODUCTION.STATE.MARKETPLACE.POPULATED", "src/app/listings/page.tsx", [
        "{listings.length === 0 ? (",
        "{listings.map((listing) =>",
      ]),
    ],
  },
  {
    route: "/marketplace/[id]",
    sourcePath: "src/app/marketplace/[id]/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.MARKETPLACE-DETAIL.MISSING",
        "src/app/listings/[id]/page.tsx",
        ["getListingForViewerById(id, user)", "catch {", "notFound();"],
        { additionalAssertions: [GLOBAL_NOT_FOUND_ASSERTION] },
      ),
      state(
        "PRODUCTION.STATE.MARKETPLACE-DETAIL.EMPTY-MEDIA",
        "src/app/listings/[id]/page.tsx",
        ["{listing.media.length > 0 ? (", "No media attached"],
      ),
      state(
        "PRODUCTION.STATE.MARKETPLACE-DETAIL.POPULATED",
        "src/app/listings/[id]/page.tsx",
        ["{listing.title}", "{formatPrice(listing.price, listing.currency)}"],
      ),
    ],
  },
  {
    route: "/marketplace/new",
    sourcePath: "src/app/marketplace/new/page.tsx",
    states: [
      state(
        "PRODUCTION.STATE.MARKETPLACE-CREATE.SIGNED-OUT",
        "src/app/listings/new/page.tsx",
        ["{canCreateListing ? (", "{user ? (", "Sign in to create marketplace items"],
      ),
      state(
        "PRODUCTION.STATE.MARKETPLACE-CREATE.TIER-BLOCKED",
        "src/app/listings/new/page.tsx",
        ["{canCreateListing ? (", "{user ? (", "Upgrade to create marketplace items"],
      ),
      state(
        "PRODUCTION.STATE.MARKETPLACE-CREATE.EDITOR",
        "src/app/listings/new/page.tsx",
        ["{canCreateListing ? (", "<form", "action={createListing}"],
      ),
    ],
  },
] as const satisfies readonly ScreenStateEvidenceContract[];
