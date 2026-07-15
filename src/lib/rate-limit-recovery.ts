export const BILLING_RATE_LIMIT_RECOVERY_SECONDS = 60;

export function prefersHtmlFormNavigation(request: Request) {
  if (request.method !== "POST") return false;
  const fetchMode = request.headers.get("sec-fetch-mode")?.toLowerCase();
  const fetchDestination = request.headers
    .get("sec-fetch-dest")
    ?.toLowerCase();
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  return (
    fetchMode === "navigate" ||
    fetchDestination === "document" ||
    acceptsHtml === true
  );
}

export const prefersHtmlRateLimitRecovery = prefersHtmlFormNavigation;

export function normalizeRateLimitRecoverySeconds(value: number) {
  if (!Number.isFinite(value)) return BILLING_RATE_LIMIT_RECOVERY_SECONDS;
  return Math.min(15 * 60, Math.max(1, Math.ceil(value)));
}
