export type BillingFailureSurface = "subscription" | "portal" | "bespoke";

export function buildBillingFailureUrl({
  appUrl,
  interval,
  surface,
}: {
  appUrl: string;
  interval?: "monthly" | "yearly";
  surface: BillingFailureSurface;
}) {
  if (surface === "subscription") {
    const url = new URL("/pricing", appUrl);
    url.searchParams.set("checkout", "failed");
    url.searchParams.set("plan", "pro");
    if (interval) url.searchParams.set("interval", interval);
    return url;
  }
  if (surface === "portal") {
    const url = new URL("/account/billing", appUrl);
    url.searchParams.set("billing", "failed");
    return url;
  }
  const url = new URL("/account/pages", appUrl);
  url.searchParams.set("bespoke", "failed");
  return url;
}

export function buildBillingRateLimitUrl({
  appUrl,
  interval,
  surface,
}: {
  appUrl: string;
  interval?: "monthly" | "yearly";
  surface: BillingFailureSurface;
}) {
  const url = buildBillingFailureUrl({ appUrl, interval, surface });
  if (surface === "subscription") {
    url.searchParams.set("checkout", "rate-limited");
  } else if (surface === "portal") {
    url.searchParams.set("billing", "rate-limited");
  } else {
    url.searchParams.set("bespoke", "rate-limited");
  }
  return url;
}
