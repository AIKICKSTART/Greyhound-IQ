import type { FamilyScreenManifest } from "./types";

export const PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-PUBLIC-RACING-INTERACTIONS",
  path: "src/components/screen-contracts/production-screen-public-racing-interactions.test.ts",
} as const;

const TEST_IDS = [
  PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_EVIDENCE_TEST.id,
] as const;

type InteractionContract = {
  queryParameters: readonly string[];
  actions: FamilyScreenManifest["actions"];
  forms: FamilyScreenManifest["forms"];
};

type InteractionAction = FamilyScreenManifest["actions"][number];

function action(
  id: string,
  result: string,
  enforcement: string,
): InteractionAction {
  return { id, result, enforcement, testIds: TEST_IDS };
}

export const PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_ROUTES = [
  "/dogs",
  "/dogs/[id]",
  "/races/[id]",
  "/meetings/[id]",
  "/tracks/[id]",
  "/breeding",
] as const;

export const PRODUCTION_SCREEN_PUBLIC_RACING_INTERACTION_CONTRACTS = {
  "/dogs": {
    queryParameters: ["q"],
    actions: [
      action(
        "DOGS.ACTION.SEARCH",
        "Searches the public greyhound index as the member types.",
        "The client waits for a non-empty query and calls GET /api/dogs/search; the route honours the search emergency control, applies an IP or bounded shared-bucket rate limit, and searchDogs normalises and truncates q to 80 characters before returning at most 20 records.",
      ),
      action(
        "DOGS.ACTION.DOG.OPEN",
        "Opens the selected greyhound profile from the result list or active keyboard option.",
        "Both pointer and Enter-key destinations use a dog identifier returned by the bounded search response and target the registered /dogs/[id] route.",
      ),
    ],
    forms: [],
  },
  "/dogs/[id]": {
    queryParameters: [],
    actions: [
      action(
        "DOG-DETAIL.ACTION.OWNERSHIP.CLAIM",
        "Submits an ownership-role claim for the loaded greyhound.",
        "claimDogOwnership requires the current profile, parses dogOwnershipClaimSchema, rate-limits the current user, rechecks the server-bound dog, rejects an existing profile/dog claim, and creates a pending audited claim inside the request context.",
      ),
      action(
        "DOG-DETAIL.ACTION.ACCOUNT.OPEN",
        "Opens account management for the current approved or pending claimant.",
        "The ownership branch uses the fixed same-origin /account destination; account access independently requires the current profile.",
      ),
      action(
        "DOG-DETAIL.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to claim the dog.",
        "The signed-out ownership branch uses the fixed same-origin /sign-in destination; the claim action independently requires the current profile.",
      ),
      action(
        "DOG-DETAIL.ACTION.PEDIGREE.DOG.OPEN",
        "Opens an available sire, dam, or ancestor profile from the pedigree.",
        "Pedigree links use dog identifiers returned by getDogPedigree for the loaded profile and target the registered /dogs/[id] route.",
      ),
      action(
        "DOG-DETAIL.ACTION.FORM.EXPAND",
        "Expands a recent-form row on compact layouts.",
        "Each native details control is bound to one server-loaded form-entry identifier and reveals only the already-rendered row details.",
      ),
      action(
        "DOG-DETAIL.ACTION.REPLAY.OPEN",
        "Opens an available official replay for a recent form entry.",
        "Replay anchors are emitted only when the server-loaded entry has a replay URL; the component adds safe external-link rel attributes for absolute destinations.",
      ),
    ],
    forms: [
      {
        id: "DOG-DETAIL.FORM.OWNERSHIP-CLAIM",
        submitsTo: "SERVER ACTION claimDogOwnership",
        schema:
          "dogId:server-bound-existing-dog-id,role:owner|co-owner|breeder|trainer,evidence?:trimmed-string(max1000)",
        testIds: TEST_IDS,
      },
    ],
  },
  "/races/[id]": {
    queryParameters: [],
    actions: [
      action(
        "RACE-DETAIL.ACTION.REPLAY.PLAY",
        "Starts an available current or previous race replay.",
        "The client activates only replay sources resolved server-side; The Dogs page URLs are host-pinned, other external sources are restricted to HTTP(S), and stream playback uses the registered replay proxy path.",
      ),
      action(
        "RACE-DETAIL.ACTION.DOG.OPEN",
        "Opens a loaded runner or winner profile.",
        "Runner and winner links use dog identifiers returned with the loaded race and target the registered /dogs/[id] route.",
      ),
      action(
        "RACE-DETAIL.ACTION.PREVIOUS.OPEN",
        "Opens the immediately preceding race in the loaded meeting when one exists.",
        "getRaceById loads at most 24 meeting races with id, number, time and display metadata; resolveMeetingRaceNavigation applies a deterministic number/time/id order, the link uses only the adjacent loaded race id, and validated list context is carried forward.",
      ),
      action(
        "RACE-DETAIL.ACTION.MEETING.OPEN",
        "Returns to the original filtered race explorer and meeting anchor, or the current meeting date/state fallback when no list context was supplied.",
        "Only bounded date, Australian state, query, status, sort and meeting-id fields are accepted; buildRaceListReturnHref constructs a same-origin /races destination and never accepts a caller-provided return URL.",
      ),
      action(
        "RACE-DETAIL.ACTION.NEXT.OPEN",
        "Opens the immediately following race in the loaded meeting when one exists.",
        "getRaceById loads at most 24 meeting races with id, number, time and display metadata; resolveMeetingRaceNavigation applies a deterministic number/time/id order, the link uses only the adjacent loaded race id, and validated list context is carried forward.",
      ),
    ],
    forms: [],
  },
  "/meetings/[id]": {
    queryParameters: [],
    actions: [
      action(
        "MEETING-DETAIL.ACTION.RACE-DAY.OPEN",
        "Returns to the race explorer for the loaded meeting date.",
        "formatRaceDateInput derives the date from the loaded meeting record and the Link targets the fixed same-origin /races route with only that bounded date query.",
      ),
      action(
        "MEETING-DETAIL.ACTION.TRACK.OPEN",
        "Opens the loaded meeting's track guide.",
        "The destination uses the track identifier selected with the stored meeting and targets the registered /tracks/[id] route.",
      ),
      action(
        "MEETING-DETAIL.ACTION.RACE.OPEN",
        "Opens a selected race from the meeting racecard.",
        "MeetingDetailRaceCard receives only races selected by getMeetingById and builds the registered /races/[id] destination from that stored race identifier.",
      ),
      action(
        "MEETING-DETAIL.ACTION.WINNER.OPEN",
        "Opens the stored winning greyhound when a first-place result exists.",
        "buildMeetingRacePresentation exposes a winner only from a stored finishingPosition of one, and the card targets the registered /dogs/[id] route with that selected dog identifier.",
      ),
    ],
    forms: [],
  },
  "/tracks/[id]": {
    queryParameters: [],
    actions: [
      action(
        "TRACK-DETAIL.ACTION.TRACKS.OPEN",
        "Returns to the public track directory.",
        "The breadcrumb uses the fixed same-origin /tracks destination.",
      ),
      action(
        "TRACK-DETAIL.ACTION.RACE.OPEN",
        "Opens a selected recent race at the loaded track.",
        "Race destinations use identifiers returned inside the loaded track meetings and target the registered /races/[id] route.",
      ),
    ],
    forms: [],
  },
  "/breeding": {
    queryParameters: [],
    actions: [
      action(
        "BREEDING.ACTION.DOGS.OPEN",
        "Opens the public greyhound search from the breeding overview.",
        "The primary call to action uses the fixed same-origin /dogs destination.",
      ),
      action(
        "BREEDING.ACTION.RACES.OPEN",
        "Opens the public race directory from the breeding overview.",
        "The secondary call to action uses the fixed same-origin /races destination.",
      ),
    ],
    forms: [],
  },
} as const satisfies Readonly<Record<string, InteractionContract>>;
