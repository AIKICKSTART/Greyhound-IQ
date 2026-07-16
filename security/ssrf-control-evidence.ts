export type SsrfControlBinding = {
  readonly surface: string;
  readonly sourceFile: string;
  readonly requiredMarkers: readonly string[];
};

export const SSRF_CONTROL_BINDINGS = [
  binding("user link previews", "src/lib/link-preview.ts", [
    "resolvePublicHttpUrl",
    "createPinnedLookup",
    'redirect: "manual"',
    "MAX_REDIRECTS = 3",
    "MAX_RESPONSE_BYTES = 512 * 1024",
    "AbortSignal.timeout(REQUEST_TIMEOUT_MS)",
    "link_preview.invalid_content_type",
  ]),
  binding("public DNS pinning", "src/lib/live/replay-network.ts", [
    "createPublicAddressLookup",
    "isPublicInternetAddress",
    "The original URL hostname remains the TLS SNI",
  ]),
  binding("operator notification webhook", "src/lib/notification-webhook-policy.ts", [
    'url.protocol !== "https:"',
    'redirect: "manual"',
    '"x-notification-secret": config.secret',
    "NOTIFICATION_WEBHOOK_TIMEOUT_MS",
  ]),
  binding("notification public-network delivery", "src/lib/notification-webhook.ts", [
    "fetchPublicInternetOrigin",
    "deliverNotificationWebhookWithFetch",
  ]),
  binding("Supabase signed URL origin", "src/lib/storage-url-policy.ts", [
    "candidate.origin !== configured.origin",
    'candidate.pathname.startsWith("/storage/v1/")',
    "shouldPinSupabaseStorageDns",
  ]),
  binding("Supabase storage fetch", "src/lib/supabase-storage.ts", [
    "assertTrustedSupabaseStorageUrl",
    "fetchPublicInternetOrigin",
    'redirect: "manual"',
  ]),
  binding("dog-card source media", "src/lib/dog-card-service.ts", [
    "objectStorage.streamObject({",
    "isObjectStorageBucket(source.storageBucket)",
    "resolveBundledDogCardPhotoPath",
    "MAX_DOG_CARD_SOURCE_BYTES",
    'redirect: "manual"',
  ]),
  binding("bounded dog-card local fallback", "src/lib/dog-card-photo-policy.ts", [
    'path.resolve(projectRoot, "public", "images")',
    "MAX_DOG_CARD_SOURCE_BYTES",
  ]),
  binding("Racing Queensland and Vimeo replay pages", "src/lib/live/race-replay.ts", [
    "fetchPublicInternetOrigin",
    'redirect: "manual"',
    "readBoundedTextResponse",
    'allowedContentTypes: ["text/html", "application/xhtml+xml"]',
  ]),
  binding("TheDogs replay pages", "src/lib/live/thedogs-replay.ts", [
    "url.origin !== base.origin",
    "fetchPublicInternetOrigin",
    'redirect: "manual"',
    "readBoundedTextResponse",
  ]),
  binding("bounded remote response body", "src/lib/remote-response.ts", [
    "allowedContentTypes",
    "remote_response.too_large",
    "reader.cancel()",
  ]),
  binding("Lago configured-origin event delivery", "src/lib/billing/lago-client.ts", [
    "lagoEventsUrl(apiUrl)",
    'redirect: "manual"',
    "AbortSignal.timeout(LAGO_REQUEST_TIMEOUT_MS)",
    "readBoundedTextResponse",
  ]),
] as const satisfies readonly SsrfControlBinding[];

export const SSRF_CONTROL_EVIDENCE_SCOPE =
  "Source-bound URL-following implementation and regression evidence. It proves application allowlisting, DNS pinning, redirect, size, time, content-type, metadata and credential-boundary controls; deployed egress-firewall behavior and external DNS/provider availability remain separate runtime gates.";

const SHARED_EVIDENCE = [
  "security/ssrf-control-evidence.ts",
  "security/ssrf-control-evidence.test.ts",
  "src/lib/link-preview.test.ts",
  "src/lib/live/replay-network.test.ts",
  "src/lib/notification-webhook.test.ts",
  "src/lib/storage-url-policy.test.ts",
  "src/lib/supabase-storage.test.ts",
  "src/lib/dog-card-photo-policy.test.ts",
  "src/lib/remote-response.test.ts",
  "scripts/check-race-replay-parsers.ts",
] as const;

const VERIFIED_CONTROL_SUFFIXES = [
  "scheme",
  "resolve-validate",
  "private-network",
  "dns-rebinding",
  "redirects",
  "size",
  "time",
  "content-type",
  "metadata",
  "credentials",
] as const;

export const SSRF_CONTROL_MASTER_EVIDENCE = {
  ...Object.fromEntries(
    VERIFIED_CONTROL_SUFFIXES.map((suffix) => [
      `security.ssrf-control.${suffix}`,
      { status: "verified" as const, evidence: SHARED_EVIDENCE },
    ]),
  ),
  "security.third-party-prohibition.ssrf": {
    status: "verified" as const,
    evidence: SHARED_EVIDENCE,
  },
  "security.third-party-prohibition.credentials": {
    status: "verified" as const,
    evidence: SHARED_EVIDENCE,
  },
};

function binding(
  surface: string,
  sourceFile: string,
  requiredMarkers: readonly string[],
): SsrfControlBinding {
  return { surface, sourceFile, requiredMarkers };
}
