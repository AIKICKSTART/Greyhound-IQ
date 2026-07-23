export const BROWSER_PERSISTENCE_ALLOWLIST = [
  {
    path: "src/components/cookie-consent.tsx",
    surface: "localStorage",
    key: "greyhoundiq.cookie-consent.v1",
    value: "accepted | declined",
  },
  {
    path: "src/components/onboarding-analytics-client.ts",
    surface: "localStorage",
    key: "greyhoundiq.cookie-consent.v1",
    value:
      "Read-only reuse of the accepted | declined consent decision; no analytics payload is persisted",
  },
  {
    path: "src/components/interactive-help.tsx",
    surface: "localStorage",
    key: "greyhoundiq.interactive-help.v1",
    value: "completed:boolean, enabled:boolean",
  },
  {
    path: "public/trainer-os.html",
    surface: "localStorage",
    key: "ghiq-demo-completed | ghiq-demo-activities | ghiq-demo-owner-sent | ghiq-demo-nominated",
    value:
      "Synthetic Trainer OS demo task IDs, bounded activity summaries, owner-send IDs and nomination IDs; free-text notes are not persisted",
  },
] as const;

export const BROWSER_URL_SURFACE_FILES = [
  "src/app/account/billing/page.tsx",
  "src/app/account/page.tsx",
  "src/app/account/team/team-invite-form.tsx",
  "src/app/admin/admin-operation-status.tsx",
  "src/app/admin/users/page.tsx",
  "src/app/races/page.tsx",
  "src/components/appearance-preview-state.ts",
  "src/components/authentication-navigation-feedback.tsx",
  "src/components/conversation-call-panel.tsx",
  "src/components/design-lab-contract-inspector-prototype.tsx",
  "src/components/design-lab-contract-inspector.tsx",
  "src/components/design-lab-pending-work-panel.tsx",
  "src/components/design-lab-scenario-controls.tsx",
  "src/components/design-lab-url-state.ts",
  "src/components/dog-search.tsx",
  "src/components/feed-comments-panel.tsx",
  "src/components/feed-infinite-list.tsx",
  "src/components/hub/hub-conversation-dock.tsx",
  "src/components/hub/hub-friends-list.tsx",
  "src/components/hub/hub-incoming-call.tsx",
  "src/components/instant-feed-controls.tsx",
  "src/components/instant-listing-enquiry-form.tsx",
  "src/components/listing-share-button.tsx",
  "src/components/master-audit-checklist.tsx",
  "src/components/mobile-bottom-dock.tsx",
  "src/components/network-recovery-banner.tsx",
  "src/components/prototype-dock-navigation.ts",
  "src/components/prototype-member-chrome.tsx",
  "src/components/prototype-switcher.tsx",
  "src/components/screen-contracts/design-lab-user-stories.ts",
  "src/components/screen-contracts/production-screen-coverage.ts",
  "src/components/screen-contracts/production-screen-member-support-interactions.ts",
  "src/components/vet-finder/VetDetail.tsx",
  "src/components/vet-finder/VetFinder.tsx",
  "src/lib/json-request.ts",
  "src/lib/marketplace-navigation.ts",
  "src/lib/query-validation.ts",
  "src/lib/race-navigation.ts",
  "src/lib/workos-redirect.ts",
] as const;

export const BROWSER_HISTORY_SURFACE_FILES = [
  "src/app/admin/admin-operation-status.tsx",
  "src/components/conversation-call-panel.tsx",
  "src/components/design-lab-contract-inspector-prototype.tsx",
  "src/components/design-lab-contract-inspector.tsx",
  "src/components/design-lab-pending-work-panel.tsx",
  "src/components/design-lab-scenario-controls.tsx",
  "src/components/dog-search.tsx",
  "src/components/hub/hub-conversation-dock.tsx",
  "src/components/hub/hub-friends-list.tsx",
  "src/components/hub/hub-incoming-call.tsx",
  "src/components/instant-listing-enquiry-form.tsx",
  "src/components/master-audit-checklist.tsx",
  "src/components/prototype-member-chrome.tsx",
  "src/components/prototype-switcher.tsx",
  "src/components/vet-finder/VetFinder.tsx",
] as const;

export const BROWSER_CLIENT_LOG_ALLOWLIST = [
  "src/app/admin/error.tsx",
  "src/app/error.tsx",
  "src/app/messages/[id]/error.tsx",
  "src/app/messages/error.tsx",
  "src/app/races/error.tsx",
  "src/components/dog-search.tsx",
] as const;

export const BROWSER_HTML_HYDRATION_SURFACES = [
  "src/app/layout.tsx",
  "src/components/json-ld.tsx",
] as const;

export const BROWSER_URL_QUERY_CAPABILITY_DECISION = {
  route: "/api/replay/stream",
  parameter: "t",
  necessity:
    "Native video and HLS manifest subresource requests cannot depend on application JavaScript adding an Authorization header; one same-origin expiring capability is therefore required for media and rewritten child-resource URLs.",
  dataMinimisation:
    "The capability contains only an authenticated encrypted expiry and allowlisted HTTPS provider target; the provider host, path and query credentials are absent from the generated browser URL.",
  persistence:
    "The capability is assigned to media/HLS subresources, not a navigation URL, local persistence, analytics or client logs.",
  containment:
    "Ten-minute expiry, fresh random IV, authenticated encryption, private no-store, no-referrer, same-origin resource policy, target revalidation and rate/concurrency limits.",
} as const;

export const OPEN_BROWSER_DATA_HANDLING_GAPS = {
  "security.browser-data-handling.html-source":
    "Rendered-artifact inspection has not yet proven every server-rendered user and conversation field is necessary.",
  "security.browser-data-handling.hydration-payloads":
    "Access tokens are removed, but the complete AuthKit and server-to-client prop graph has not yet been inspected in a production artifact.",
  "security.browser-data-handling.public-source-maps":
    "Source configuration does not enable browser source maps, but a fresh production artifact has not yet been scanned.",
} as const;

const BROWSER_DATA_HANDLING_EVIDENCE = [
  "package.json",
  "next.config.ts",
  "public/trainer-os.html",
  "src/app/layout.tsx",
  "src/app/api/replay/stream/handler.ts",
  "src/app/api/replay/stream/route.ts",
  "src/app/admin/users/actions.ts",
  "src/app/admin/users/page.tsx",
  "src/app/admin/error.tsx",
  "src/app/error.tsx",
  "src/app/messages/error.tsx",
  "src/app/messages/[id]/error.tsx",
  "src/app/races/error.tsx",
  "src/components/cookie-consent.tsx",
  "src/components/interactive-help.tsx",
  "src/components/interactive-help-state.ts",
  "src/components/dog-search.tsx",
  "src/components/design-lab-contract-inspector-model.ts",
  "src/components/design-lab-pending-work-panel.tsx",
  "src/components/design-lab-scenario-state.ts",
  "src/components/design-lab-url-state.ts",
  "src/components/master-audit-checklist.tsx",
  "src/components/onboarding-analytics-client.ts",
  "src/components/race-replay-player.tsx",
  "src/components/listing-share-button.tsx",
  "src/components/prototype-dock-navigation.ts",
  "src/components/prototype-member-dock-navigation.test.ts",
  "src/lib/race-navigation.ts",
  "src/lib/live/replay-proxy.ts",
  "src/lib/live/replay-proxy.test.ts",
  "src/lib/marketplace-navigation.ts",
  "security/browser-data-handling-evidence.test.ts",
] as const;

const VERIFIED_BROWSER_DATA_HANDLING_IDS = [
  "security.browser-data-handling.local-storage",
  "security.browser-data-handling.session-storage",
  "security.browser-data-handling.indexeddb",
  "security.browser-data-handling.service-worker-caches",
  "security.browser-data-handling.browser-history",
  "security.browser-data-handling.analytics-payloads",
  "security.browser-data-handling.client-logs",
  "security.browser-data-handling.error-reporting-payloads",
  "security.browser-data-handling.persisted-client-state",
  "security.browser-data-handling.urls",
  "security.browser-data-handling.query-strings",
] as const;

export const BROWSER_DATA_HANDLING_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_BROWSER_DATA_HANDLING_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: BROWSER_DATA_HANDLING_EVIDENCE },
  ]),
);
