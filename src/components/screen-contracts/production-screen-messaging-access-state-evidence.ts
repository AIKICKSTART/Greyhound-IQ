import type { FamilyScreenManifest, NonEmpty } from "./types";

export const PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-MESSAGING-ACCESS-STATE-EVIDENCE",
  path: "src/components/screen-contracts/production-screen-messaging-access-state-evidence.test.ts",
} as const satisfies FamilyScreenManifest["tests"][number];

const TEST_IDS = [
  PRODUCTION_SCREEN_MESSAGING_ACCESS_STATE_EVIDENCE_TEST.id,
] as const;

type SourceAssertion = {
  sourcePath: string;
  orderedText: NonEmpty<string>;
};

type ScreenStateWithEvidence = FamilyScreenManifest["states"][number] & {
  sourceAssertions: NonEmpty<SourceAssertion>;
};

type MessagingPermissionContract = {
  route: string;
  sourcePath: string;
  canonicalSourcePath: string;
  permissions: FamilyScreenManifest["permissions"];
};

type MessagingStateContract = {
  route: string;
  sourcePath: string;
  states: NonEmpty<ScreenStateWithEvidence>;
};

function state(
  id: string,
  sourceAssertions: NonEmpty<SourceAssertion>,
  recoveryActionId?: string,
): ScreenStateWithEvidence {
  return {
    id,
    testIds: TEST_IDS,
    ...(recoveryActionId ? { recoveryActionId } : {}),
    sourceAssertions,
  };
}

const INBOX_PERMISSIONS = [
  {
    actor: "Signed-out visitor requesting private Pulse inbox records",
    decision: "deny",
    enforcedBy:
      "MessagesPage derives a null database context from the missing session and supplies empty conversations, unread counts, and friends without calling any private record service.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated member viewing their Pulse inbox",
    decision: "allow",
    enforcedBy:
      "MessagesPage passes only the current server-resolved profile context, and listConversationsForProfile restricts every row to conversations where that profile is participant A or B.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

const THREAD_PERMISSIONS = [
  {
    actor: "Signed-out visitor requesting a private Pulse thread",
    decision: "deny",
    enforcedBy:
      "MessageThreadPage returns the signed-out boundary before getConversationForProfile, message search, call, presence, or thread record work can run.",
    testIds: TEST_IDS,
  },
  {
    actor: "Signed-in non-participant requesting a private Pulse thread",
    decision: "deny",
    enforcedBy:
      "getConversationForProfile combines the requested identifier with the current profile participant predicate, and MessageThreadPage maps a rejected lookup to the same not-found response.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated conversation participant viewing their Pulse thread",
    decision: "allow",
    enforcedBy:
      "getConversationForProfile resolves the thread and visible messages only through the current participant's request context before the page renders private records.",
    testIds: TEST_IDS,
  },
  {
    actor: "Blocked conversation participant sending a message or starting a call",
    decision: "deny",
    enforcedBy:
      "sendConversationMessage rejects any conversation block before message creation, and call creation independently rejects the same blocked relationship before LiveKit work.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

const FRIENDS_PERMISSIONS = [
  {
    actor: "Signed-out visitor requesting private Pulse friend records",
    decision: "deny",
    enforcedBy:
      "PulseFriendsPage derives a null database context from the missing session and returns an empty list without calling listFriendsForProfile.",
    testIds: TEST_IDS,
  },
  {
    actor: "Authenticated member viewing their accepted Pulse friends",
    decision: "allow",
    enforcedBy:
      "listFriendsForProfile requires the server-resolved profile context and selects only accepted friendships where that profile is profile A or B.",
    testIds: TEST_IDS,
  },
] as const satisfies FamilyScreenManifest["permissions"];

export const PRODUCTION_SCREEN_MESSAGING_PERMISSION_CONTRACTS = [
  {
    route: "/messages",
    sourcePath: "src/app/messages/page.tsx",
    canonicalSourcePath: "src/app/messages/page.tsx",
    permissions: INBOX_PERMISSIONS,
  },
  {
    route: "/messages/[id]",
    sourcePath: "src/app/messages/[id]/page.tsx",
    canonicalSourcePath: "src/app/messages/[id]/page.tsx",
    permissions: THREAD_PERMISSIONS,
  },
  {
    route: "/messages/friends",
    sourcePath: "src/app/messages/friends/page.tsx",
    canonicalSourcePath: "src/app/messages/friends/page.tsx",
    permissions: FRIENDS_PERMISSIONS,
  },
  {
    route: "/pulse",
    sourcePath: "src/app/pulse/page.tsx",
    canonicalSourcePath: "src/app/messages/page.tsx",
    permissions: INBOX_PERMISSIONS,
  },
  {
    route: "/pulse/[id]",
    sourcePath: "src/app/pulse/[id]/page.tsx",
    canonicalSourcePath: "src/app/messages/[id]/page.tsx",
    permissions: THREAD_PERMISSIONS,
  },
  {
    route: "/pulse/friends",
    sourcePath: "src/app/pulse/friends/page.tsx",
    canonicalSourcePath: "src/app/messages/friends/page.tsx",
    permissions: FRIENDS_PERMISSIONS,
  },
] as const satisfies readonly MessagingPermissionContract[];

const THREAD_PAGE = "src/app/messages/[id]/page.tsx";
const FRIENDS_PAGE = "src/app/messages/friends/page.tsx";
const INBOX_PAGE = "src/app/messages/page.tsx";

export const PRODUCTION_SCREEN_MESSAGING_STATE_CONTRACTS = [
  {
    route: "/messages/[id]",
    sourcePath: THREAD_PAGE,
    states: [
      state("PRODUCTION.STATE.MESSAGE-THREAD.LOADING", [
        {
          sourcePath: "src/app/messages/loading.tsx",
          orderedText: [
            "export default function Loading()",
            '<SkeletonGroup label="Loading Pulse">',
          ],
        },
      ]),
      state("PRODUCTION.STATE.MESSAGE-THREAD.SIGNED-OUT", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "if (!user?.profileId || !user.dbUserId) return <SignedOutThread />;",
            "Sign in to view this Pulse conversation",
            'href="/sign-in"',
          ],
        },
      ]),
      state("PRODUCTION.STATE.MESSAGE-THREAD.INACCESSIBLE", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "conversation = await getConversationForProfile(",
            "} catch {",
            "notFound();",
          ],
        },
      ]),
      state("PRODUCTION.STATE.MESSAGE-THREAD.PRIVATE", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "conversation = await getConversationForProfile(",
            "Private Pulse conversation",
          ],
        },
      ]),
      state("PRODUCTION.STATE.MESSAGE-THREAD.BLOCKED-BY-ME", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "const blockedByMe = conversation.blockedById === user.profileId;",
            "You blocked this conversation. Unblock before sending new messages.",
          ],
        },
      ]),
      state("PRODUCTION.STATE.MESSAGE-THREAD.BLOCKED-BY-OTHER", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "const blockedByMe = conversation.blockedById === user.profileId;",
            "This conversation is blocked by the other participant.",
          ],
        },
      ]),
      state("PRODUCTION.STATE.MESSAGE-THREAD.EMPTY", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "{threadItems.length === 0 ? (",
            "No visible messages in this conversation.",
          ],
        },
      ]),
      state("PRODUCTION.STATE.MESSAGE-THREAD.POPULATED", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "{threadItems.length === 0 ? (",
            "threadItems.map((item) => {",
          ],
        },
      ]),
      state(
        "PRODUCTION.STATE.MESSAGE-THREAD.RECOVERABLE-ERROR",
        [
          {
            sourcePath: "src/app/messages/[id]/error.tsx",
            orderedText: [
              "export default function ConversationError({",
              "CONVERSATION UNAVAILABLE",
              "onClick={reset}",
              "Try again",
              'href="/pulse"',
              "Back to Pulse",
            ],
          },
        ],
        "MESSAGE-THREAD.ACTION.INBOX.OPEN",
      ),
    ],
  },
  {
    route: "/messages/friends",
    sourcePath: FRIENDS_PAGE,
    states: [
      state("PRODUCTION.STATE.MESSAGES-FRIENDS.LOADING", [
        {
          sourcePath: "src/app/messages/loading.tsx",
          orderedText: [
            "export default function Loading()",
            '<SkeletonGroup label="Loading Pulse">',
          ],
        },
      ]),
      state("PRODUCTION.STATE.MESSAGES-FRIENDS.SIGNED-OUT", [
        {
          sourcePath: FRIENDS_PAGE,
          orderedText: [
            "{!user ? (",
            "Sign in to view friends",
            'href="/sign-in"',
          ],
        },
      ]),
      state("PRODUCTION.STATE.MESSAGES-FRIENDS.EMPTY", [
        {
          sourcePath: FRIENDS_PAGE,
          orderedText: [
            ") : friends.length === 0 ? (",
            "No friends yet",
          ],
        },
      ]),
      state("PRODUCTION.STATE.MESSAGES-FRIENDS.POPULATED", [
        {
          sourcePath: FRIENDS_PAGE,
          orderedText: [
            ") : friends.length === 0 ? (",
            "{friends.map((friend) => (",
          ],
        },
      ]),
      state(
        "PRODUCTION.STATE.MESSAGES-FRIENDS.RECOVERABLE-ERROR",
        [
          {
            sourcePath: "src/app/messages/error.tsx",
            orderedText: [
              "export default function MessagesError({",
              "PULSE UNAVAILABLE",
              "onClick={reset}",
              "Try again",
            ],
          },
        ],
        "MESSAGES.ACTION.RETRY",
      ),
    ],
  },
  {
    route: "/pulse",
    sourcePath: "src/app/pulse/page.tsx",
    states: [
      state("PRODUCTION.STATE.PULSE.SIGNED-OUT", [
        {
          sourcePath: "src/app/pulse/page.tsx",
          orderedText: [
            'import PulsePage, { metadata } from "../messages/page";',
            "export default PulsePage;",
          ],
        },
        {
          sourcePath: INBOX_PAGE,
          orderedText: ["{!user ? (", "Sign in to open Pulse"],
        },
      ]),
      state("PRODUCTION.STATE.PULSE.EMPTY", [
        {
          sourcePath: INBOX_PAGE,
          orderedText: [
            "{conversations.length === 0 ? (",
            "No conversations yet",
          ],
        },
      ]),
      state("PRODUCTION.STATE.PULSE.POPULATED", [
        {
          sourcePath: INBOX_PAGE,
          orderedText: [
            "{conversations.length === 0 ? (",
            "{conversations.map((conversation) => {",
          ],
        },
      ]),
    ],
  },
  {
    route: "/pulse/[id]",
    sourcePath: "src/app/pulse/[id]/page.tsx",
    states: [
      state("PRODUCTION.STATE.PULSE-THREAD.SIGNED-OUT", [
        {
          sourcePath: "src/app/pulse/[id]/page.tsx",
          orderedText: [
            '} from "../../messages/[id]/page";',
            "export default PulseThreadPage;",
          ],
        },
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "if (!user?.profileId || !user.dbUserId) return <SignedOutThread />;",
            "Sign in to view this Pulse conversation",
          ],
        },
      ]),
      state("PRODUCTION.STATE.PULSE-THREAD.INACCESSIBLE", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "conversation = await getConversationForProfile(",
            "} catch {",
            "notFound();",
          ],
        },
      ]),
      state("PRODUCTION.STATE.PULSE-THREAD.PRIVATE", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "conversation = await getConversationForProfile(",
            "Private Pulse conversation",
          ],
        },
      ]),
      state("PRODUCTION.STATE.PULSE-THREAD.BLOCKED-BY-ME", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "const blockedByMe = conversation.blockedById === user.profileId;",
            "You blocked this conversation. Unblock before sending new messages.",
          ],
        },
      ]),
      state("PRODUCTION.STATE.PULSE-THREAD.BLOCKED-BY-OTHER", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "const blockedByMe = conversation.blockedById === user.profileId;",
            "This conversation is blocked by the other participant.",
          ],
        },
      ]),
      state("PRODUCTION.STATE.PULSE-THREAD.EMPTY", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "{threadItems.length === 0 ? (",
            "No visible messages in this conversation.",
          ],
        },
      ]),
      state("PRODUCTION.STATE.PULSE-THREAD.POPULATED", [
        {
          sourcePath: THREAD_PAGE,
          orderedText: [
            "{threadItems.length === 0 ? (",
            "threadItems.map((item) => {",
          ],
        },
      ]),
    ],
  },
  {
    route: "/pulse/friends",
    sourcePath: "src/app/pulse/friends/page.tsx",
    states: [
      state("PRODUCTION.STATE.PULSE-FRIENDS.SIGNED-OUT", [
        {
          sourcePath: "src/app/pulse/friends/page.tsx",
          orderedText: [
            'import PulseFriendsPage, { metadata } from "../../messages/friends/page";',
            "export default PulseFriendsPage;",
          ],
        },
        {
          sourcePath: FRIENDS_PAGE,
          orderedText: ["{!user ? (", "Sign in to view friends"],
        },
      ]),
      state("PRODUCTION.STATE.PULSE-FRIENDS.EMPTY", [
        {
          sourcePath: FRIENDS_PAGE,
          orderedText: [") : friends.length === 0 ? (", "No friends yet"],
        },
      ]),
      state("PRODUCTION.STATE.PULSE-FRIENDS.POPULATED", [
        {
          sourcePath: FRIENDS_PAGE,
          orderedText: [
            ") : friends.length === 0 ? (",
            "{friends.map((friend) => (",
          ],
        },
      ]),
    ],
  },
] as const satisfies readonly MessagingStateContract[];

export const PRODUCTION_SCREEN_MESSAGING_PERMISSION_ROUTES = [
  "/messages",
  "/messages/[id]",
  "/messages/friends",
  "/pulse",
  "/pulse/[id]",
  "/pulse/friends",
] as const;

export const PRODUCTION_SCREEN_MESSAGING_STATE_ROUTES = [
  "/messages/[id]",
  "/messages/friends",
  "/pulse",
  "/pulse/[id]",
  "/pulse/friends",
] as const;

export const PRODUCTION_SCREEN_REMAINING_OPEN_PERMISSION_ROUTES = [] as const;

export const PRODUCTION_SCREEN_REMAINING_OPEN_STATE_ROUTES = [] as const;
