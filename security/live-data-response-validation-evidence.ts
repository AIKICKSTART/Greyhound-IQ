export const LIVE_DATA_RESPONSE_VALIDATION_REQUIREMENT_IDS = [
  "security.third-party-response-validation.response-schema",
  "security.third-party-response-validation.field-types",
  "security.third-party-response-validation.length",
  "security.third-party-response-validation.identifiers",
  "security.third-party-response-validation.urls",
  "security.third-party-response-validation.media",
  "security.third-party-response-validation.status-values",
  "security.third-party-response-validation.currency",
  "security.third-party-response-validation.timestamps",
  "security.third-party-response-validation.signatures-where-available",
  "security.third-party-response-validation.duplicate-records",
  "security.third-party-response-validation.unexpected-fields",
  "security.third-party-response-validation.missing-fields",
  "security.third-party-response-validation.untrusted",
] as const;

export const LIVE_DATA_RESPONSE_VALIDATION_PROVIDERS = [
  {
    provider: "TheDogs meeting/result ingestion",
    sourceFile: "src/lib/live/thedogs.ts",
    controls: [
      "bounded streamed response",
      "content-type allowlist",
      "request deadline",
      "redirect refusal",
      "same-origin follow-up requests and stored provider URLs",
      "same-origin media URL normalization",
      "bounded text, collections, identifiers, timestamps and money",
      "duplicate meeting/race collapse",
    ],
  },
  {
    provider: "FastTrack prototype meeting/result ingestion",
    sourceFile: "src/lib/live/fasttrack.ts",
    controls: [
      "bounded streamed response",
      "content-type allowlist",
      "request deadline",
      "redirect refusal",
      "numeric-only provider paths",
      "bounded text, collections, identifiers, timestamps and money",
      "duplicate meeting collapse",
    ],
  },
  {
    provider: "Watchdog form/result ingestion",
    sourceFile: "src/lib/live/watchdog.ts",
    schemaFile: "src/lib/live/watchdog-response.ts",
    controls: [
      "bounded streamed response",
      "content-type allowlist",
      "request deadline",
      "redirect refusal",
      "runtime envelope and record schemas",
      "field, identifier, URL, status, timestamp and money bounds",
      "unknown-field stripping and duplicate rejection",
      "participants missing a usable dog identifier or name are isolated",
    ],
  },
] as const;

export const LIVE_DATA_RESPONSE_VALIDATION_EVIDENCE = [
  "src/lib/remote-response.ts",
  "src/lib/remote-response.test.ts",
  "src/lib/live/thedogs.ts",
  "src/lib/live/thedogs.test.ts",
  "src/lib/live/fasttrack.ts",
  "src/lib/live/watchdog.ts",
  "src/lib/live/watchdog-response.ts",
  "src/lib/live/provider-response-validation.test.ts",
  "security/live-data-response-validation-evidence.ts",
  "security/live-data-response-validation-evidence.test.ts",
] as const;

export const LIVE_DATA_RESPONSE_VALIDATION_SCOPE_STATUS =
  "source-verified-for-three-target-adapters" as const;

export const LIVE_DATA_RESPONSE_SIGNATURE_DISPOSITION =
  "Not applicable in the three-adapter scope: these public read-only responses expose no response-signature contract. TLS and host allowlists are transport controls, not signature evidence.";

export const LIVE_DATA_RESPONSE_VALIDATION_GLOBAL_GAP =
  "The 14 immutable third-party-response-validation requirements remain global gates. This batch proves only the TheDogs meeting/result, FastTrack prototype and Watchdog adapters. Topaz is owned by the lead, while TheDogs profile/replay, race-replay discovery and every non-racing provider response still require exhaustive evidence before any global requirement or external-input surface is promoted.";
