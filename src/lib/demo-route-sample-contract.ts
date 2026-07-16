export const DEMO_PROVIDER_ROUTE_IDS = {
  dog: "demo-provider-dog",
  meeting: "demo-provider-meeting",
  race: "demo-provider-race",
  track: "demo-provider-track",
} as const;

export const DEMO_PROVIDER_ROUTE_PATHS = {
  dog: `/dogs/${DEMO_PROVIDER_ROUTE_IDS.dog}`,
  meeting: `/meetings/${DEMO_PROVIDER_ROUTE_IDS.meeting}`,
  race: `/races/${DEMO_PROVIDER_ROUTE_IDS.race}`,
  track: `/tracks/${DEMO_PROVIDER_ROUTE_IDS.track}`,
} as const;

export type DemoProviderRouteKind = keyof typeof DEMO_PROVIDER_ROUTE_IDS;
