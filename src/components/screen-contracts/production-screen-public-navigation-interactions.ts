import type { FamilyScreenManifest } from "./types";

export const PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-PUBLIC-NAVIGATION-INTERACTIONS",
  path: "src/components/screen-contracts/production-screen-public-navigation-interactions.test.ts",
} as const;

const TEST_IDS = [
  PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_EVIDENCE_TEST.id,
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

export const PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_ROUTES = [
  "/",
  "/about",
  "/auth/error",
  "/privacy",
  "/responsible-use",
  "/terms",
] as const;

export const PRODUCTION_SCREEN_PUBLIC_NAVIGATION_INTERACTION_CONTRACTS = {
  "/": {
    queryParameters: [],
    actions: [
      action(
        "HOME.ACTION.RACES.JUMP",
        "Moves to today's race-card section on the home page.",
        "HomeHero defaults its primary destination to the fixed same-page #races fragment.",
      ),
      action(
        "HOME.ACTION.PRICING.OPEN",
        "Opens public plan information.",
        "The fixed same-origin Link targets the registered /pricing route.",
      ),
      action(
        "HOME.ACTION.FEATURE.OPEN",
        "Opens the selected racing, AI, breeding, or statistics feature.",
        "Feature destinations come from the reviewed in-source FEATURES catalogue and target registered same-origin routes.",
      ),
      action(
        "HOME.ACTION.RACE-EXPLORER.OPEN",
        "Opens the race explorer when today's meeting list is empty.",
        "The empty-state Link uses the fixed same-origin /races destination.",
      ),
      action(
        "HOME.ACTION.TRACK.OPEN",
        "Opens the track guide for a loaded meeting.",
        "Meeting-card track destinations use the identifier returned by the public meeting query and the registered dynamic route owns the destination.",
      ),
      action(
        "HOME.ACTION.RACE.OPEN",
        "Opens a loaded race from its race slot or featured-race control.",
        "Race destinations use identifiers returned with the public meeting query and the registered dynamic route owns the destination.",
      ),
    ],
    forms: [],
  },
  "/about": {
    queryParameters: [],
    actions: [
      action(
        "ABOUT.ACTION.CONTACT.OPEN",
        "Opens GreyhoundIQ's public contact route.",
        "The fixed same-origin Link targets /contact.",
      ),
    ],
    forms: [],
  },
  "/auth/error": {
    queryParameters: ["reason", "ref"],
    actions: [
      action(
        "AUTH-ERROR.ACTION.SIGN-IN.RETRY",
        "Starts a fresh sign-in attempt with the member feed as the return destination.",
        "The fixed same-origin Link targets /sign-in with an encoded /feed return path; reason and reference query values are never forwarded into it.",
      ),
      action(
        "AUTH-ERROR.ACTION.CONTACT.OPEN",
        "Opens public support after an interrupted sign-in.",
        "The fixed same-origin Link targets /contact.",
      ),
      action(
        "AUTH-ERROR.ACTION.HOME.OPEN",
        "Returns to the public home page.",
        "The fixed same-origin Link targets /.",
      ),
    ],
    forms: [],
  },
  "/privacy": {
    queryParameters: [],
    actions: [
      action(
        "PRIVACY.ACTION.COOKIE.DECLINE",
        "Declines optional analytics for the current browser.",
        "The client control writes only the literal declined value under the fixed local-storage key and emits the fixed consent event; storage failure is contained locally.",
      ),
      action(
        "PRIVACY.ACTION.COOKIE.ACCEPT",
        "Accepts optional analytics for the current browser.",
        "The client control writes only the literal accepted value under the fixed local-storage key and emits the fixed consent event; storage failure is contained locally.",
      ),
      action(
        "PRIVACY.ACTION.GAMBLING-HELP.OPEN",
        "Opens the external Gambling Help Online service.",
        "The fixed HTTPS anchor opens in a new tab with noopener and noreferrer isolation.",
      ),
      action(
        "PRIVACY.ACTION.CONTACT.OPEN",
        "Opens GreyhoundIQ's public contact route for privacy questions.",
        "The fixed same-origin Link targets /contact.",
      ),
    ],
    forms: [],
  },
  "/responsible-use": {
    queryParameters: [],
    actions: [
      action(
        "RESPONSIBLE-USE.ACTION.HELP.CALL",
        "Opens the device calling flow for Gambling Help Online.",
        "The fixed tel anchor contains the published Australian support number and no user-controlled value.",
      ),
      action(
        "RESPONSIBLE-USE.ACTION.HELP.ONLINE",
        "Opens the external Gambling Help Online service.",
        "The fixed HTTPS anchor opens in a new tab with noopener and noreferrer isolation.",
      ),
      action(
        "RESPONSIBLE-USE.ACTION.CONTACT.OPEN",
        "Opens GreyhoundIQ's public contact route.",
        "The fixed same-origin Link targets /contact.",
      ),
      action(
        "RESPONSIBLE-USE.ACTION.TERMS.OPEN",
        "Opens GreyhoundIQ's terms of service.",
        "The fixed same-origin Link targets /terms.",
      ),
      action(
        "RESPONSIBLE-USE.ACTION.PRIVACY.OPEN",
        "Opens GreyhoundIQ's privacy policy.",
        "The fixed same-origin Link targets /privacy.",
      ),
    ],
    forms: [],
  },
  "/terms": {
    queryParameters: [],
    actions: [
      action(
        "TERMS.ACTION.CONTACT.OPEN",
        "Opens GreyhoundIQ's public contact route for terms questions.",
        "The fixed same-origin Link targets /contact.",
      ),
    ],
    forms: [],
  },
} as const satisfies Readonly<Record<string, InteractionContract>>;
