export const DEMO_ADMIN_EMAIL = "admin@greyhoundiq.test";
export const DEMO_ADMIN_DISPLAY_NAME = "Adele Admin";
export const DEMO_SUPPRESS_OVERLAYS_HEADER = "x-giq-suppress-overlays";

export type DemoAccessEnv = {
  APP_ENV?: string;
  DEMO_AUTH_MODE?: string;
};

export function isFullAccessDemo(env?: DemoAccessEnv) {
  const source = env ?? {
    APP_ENV: process.env.APP_ENV,
    DEMO_AUTH_MODE: process.env.DEMO_AUTH_MODE,
  };
  return (
    source.APP_ENV?.trim().toLowerCase() === "demo" &&
    source.DEMO_AUTH_MODE?.trim().toLowerCase() === "full-access"
  );
}

export function isDemoReadMethod(method: string) {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function isDemoOverlayRequest(
  fetchDestination: string | null,
  view: string | null
) {
  return fetchDestination === "iframe" || view === "admin-frames";
}
