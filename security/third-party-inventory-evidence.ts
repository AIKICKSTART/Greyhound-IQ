export type ThirdPartySourceBinding = {
  readonly providerId: string;
  readonly sourceFile: string;
  readonly sourceMarker: string;
};

export const THIRD_PARTY_SOURCE_BINDINGS = [
  binding("THIRD_PARTY.WORKOS", "src/lib/auth.ts", "@workos-inc/authkit-nextjs"),
  binding("THIRD_PARTY.STRIPE", "src/lib/billing/stripe-client.ts", 'from "stripe"'),
  binding("THIRD_PARTY.SUPABASE_REALTIME", "src/lib/realtime-service.ts", "@supabase/supabase-js"),
  binding("THIRD_PARTY.SUPABASE_STORAGE", "src/lib/supabase-storage.ts", "SUPABASE_SERVICE_ROLE_KEY"),
  binding("THIRD_PARTY.LAGO", "src/lib/billing/lago-env.ts", "LAGO_API_URL"),
  binding("THIRD_PARTY.LIVEKIT", "src/lib/call-token.ts", "livekit-server-sdk"),
  binding("THIRD_PARTY.OPENAI", "src/lib/dog-card-service.ts", "https://api.openai.com/v1/images/edits"),
  binding("THIRD_PARTY.THEDOGS", "src/lib/live/thedogs.ts", "https://www.thedogs.com.au"),
  binding("THIRD_PARTY.FASTTRACK", "src/lib/live/fasttrack.ts", "https://fasttrack.grv.org.au"),
  binding("THIRD_PARTY.WATCHDOG", "src/lib/live/watchdog.ts", "https://watchdog.grv.org.au"),
  binding("THIRD_PARTY.TOPAZ", "src/lib/live/topaz.ts", "https://topaz.grv.org.au/api"),
  binding("THIRD_PARTY.RACING_QUEENSLAND", "src/lib/live/race-replay.ts", "https://www.racingqueensland.com.au"),
  binding("THIRD_PARTY.TASRACING", "src/lib/live/race-replay.ts", "tasracing-race-replays.s3.ap-southeast-2.amazonaws.com"),
  binding("THIRD_PARTY.YOUTUBE", "src/lib/live/race-replay.ts", "youtube-nocookie.com"),
  binding("THIRD_PARTY.VIMEO", "src/lib/live/race-replay.ts", "player.vimeo.com"),
  binding("THIRD_PARTY.GOOGLE_CLOUD", ".github/workflows/cloud-run-deploy.yml", "gcloud run deploy"),
  binding("THIRD_PARTY.GITHUB", ".github/workflows/ci.yml", "actions/checkout@"),
  binding("THIRD_PARTY.NOTIFICATION_WEBHOOK", "src/lib/notification-webhook-policy.ts", "NOTIFICATION_WEBHOOK_URL"),
] as const satisfies readonly ThirdPartySourceBinding[];

export const THIRD_PARTY_INVENTORY_SCOPE =
  "Complete source-visible external-service inventory. This proves registry coverage and explicit unknowns, not provider contracts, deployed credentials, retention, residency, availability or runtime control effectiveness.";

const THIRD_PARTY_INVENTORY_EVIDENCE = [
  "security/third-parties.ts",
  "security/third-party-inventory-evidence.ts",
  "security/third-party-inventory-evidence.test.ts",
  "docs/security/third-party-register.md",
] as const;

export const THIRD_PARTY_INVENTORY_MASTER_EVIDENCE = {
  "security.third-party-inventory.all-providers": {
    status: "verified" as const,
    evidence: THIRD_PARTY_INVENTORY_EVIDENCE,
  },
};

function binding(
  providerId: string,
  sourceFile: string,
  sourceMarker: string,
): ThirdPartySourceBinding {
  return { providerId, sourceFile, sourceMarker };
}
