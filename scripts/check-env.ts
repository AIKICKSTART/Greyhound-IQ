import { loadEnvConfig } from "@next/env";
import { databaseUrlConfigurationError } from "../src/lib/database-url";
import { resolveNotificationWebhookConfig } from "../src/lib/notification-webhook-policy";

loadEnvConfig(process.cwd());

type EnvSpec = {
  names: string[];
  description: string;
  productionOnly?: boolean;
  validate?: (value: string) => string | null;
};

const args = new Set(process.argv.slice(2));
const production = args.has("--production") || process.env.NODE_ENV === "production";
const ci = args.has("--ci");

const specs: EnvSpec[] = [
  {
    names: ["DATABASE_URL"],
    description: "Prisma Postgres connection string for the self-hosted Supabase database",
    validate: validateDatabaseUrl,
  },
  {
    names: ["NEXTAUTH_URL"],
    description: "public app URL used by auth callbacks",
    productionOnly: true,
    validate: validateUrl,
  },
  {
    names: ["NEXTAUTH_SECRET", "AUTH_SECRET"],
    description: "server-side signing secret for sessions",
    productionOnly: true,
    validate: (value) =>
      value.length >= 32 ? null : "must be at least 32 characters",
  },
  {
    names: ["REPLAY_PROXY_SECRET"],
    description: "dedicated server-only HMAC secret for short-lived replay URLs",
    productionOnly: true,
    validate: (value) =>
      value.length >= 32 ? null : "must be at least 32 characters",
  },
  {
    names: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
    description: "Supabase project URL for database-adjacent services and Storage",
    productionOnly: true,
    validate: validateUrl,
  },
  {
    names: ["NEXT_PUBLIC_SUPABASE_URL"],
    description: "browser-visible Supabase project URL for Storage uploads",
    productionOnly: true,
    validate: validateUrl,
  },
  {
    names: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    description: "browser-visible Supabase anon key for Storage signed uploads",
    productionOnly: true,
  },
  {
    names: ["SUPABASE_SERVICE_ROLE_KEY"],
    description: "server-only Supabase service-role key for signed Storage operations",
    productionOnly: true,
  },
  {
    names: ["WORKOS_CLIENT_ID"],
    description: "WorkOS AuthKit client id",
    productionOnly: true,
    validate: validateWorkosClientId,
  },
  {
    names: ["WORKOS_API_KEY"],
    description: "WorkOS API key",
    productionOnly: true,
  },
  {
    names: ["WORKOS_COOKIE_PASSWORD"],
    description: "WorkOS sealed-session cookie password",
    productionOnly: true,
    validate: (value) =>
      value.length >= 32 ? null : "must be at least 32 characters",
  },
  {
    names: ["NEXT_PUBLIC_WORKOS_REDIRECT_URI"],
    description: "WorkOS browser redirect URI",
    productionOnly: true,
    validate: validateUrl,
  },
  {
    names: ["LAGO_API_URL"],
    description: "Lago API base URL for billing and metering calls",
    productionOnly: true,
    validate: validateUrl,
  },
  {
    names: ["LAGO_FRONT_URL"],
    description: "Lago frontend URL for billing customer/admin flows",
    productionOnly: true,
    validate: validateUrl,
  },
  {
    names: ["LAGO_API_KEY"],
    description: "server-only Lago API key",
    productionOnly: true,
  },
  {
    names: ["LAGO_WEBHOOK_SECRET"],
    description: "server-only Lago webhook signing secret",
    productionOnly: true,
    validate: (value) =>
      value.length >= 32 ? null : "must be at least 32 characters",
  },
  {
    names: ["INTERNAL_API_SECRET", "INTERNAL_SECRET", "CRON_SECRET"],
    description: "shared secret for internal maintenance routes",
    productionOnly: true,
    validate: (value) =>
      value.length >= 32 ? null : "must be at least 32 characters",
  },
  {
    names: ["SUPABASE_JWT_SECRET"],
    description: "server-only key for short-lived Realtime authorization JWTs",
    productionOnly: true,
    validate: (value) =>
      value.length >= 32 ? null : "must be at least 32 characters",
  },
  {
    names: ["REALTIME_CHANNEL_SECRET"],
    description: "server-only HMAC secret deriving realtime channel names",
    productionOnly: true,
    validate: (value) =>
      value.length >= 32 ? null : "must be at least 32 characters",
  },
  {
    names: ["LIVEKIT_URL"],
    description: "LiveKit server URL for call token issuance",
    productionOnly: true,
    validate: validateUrl,
  },
  {
    names: ["LIVEKIT_API_KEY"],
    description: "LiveKit API key",
    productionOnly: true,
  },
  {
    names: ["LIVEKIT_API_SECRET"],
    description: "server-only LiveKit API secret",
    productionOnly: true,
  },
  {
    names: ["NEXT_PUBLIC_LIVEKIT_URL"],
    description: "browser-visible LiveKit URL for client call connections",
    productionOnly: true,
    validate: validateUrl,
  },
];

const optional = [
  "DATABASE_IMPORT_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "LAGO_API_URL",
  "LAGO_FRONT_URL",
  "LAGO_API_KEY",
  "LAGO_WEBHOOK_SECRET",
  "TOPAZ_API_KEY",
  "TOPAZ_API_BASE",
  "TOPAZ_OWNING_AUTHORITY_CODE",
  "TOPAZ_TIME_ZONE",
  "THEDOGS_PROVIDER_ENABLED",
  "THEDOGS_BASE_URL",
  "THEDOGS_MAX_MEETINGS",
  "THEDOGS_CONCURRENCY",
  "THEDOGS_TIME_ZONE",
  "WATCHDOG_PROVIDER_ENABLED",
  "WATCHDOG_BASE_URL",
  "WATCHDOG_MAX_MEETINGS",
  "WATCHDOG_CONCURRENCY",
  "WATCHDOG_FETCH_TIMEOUT_MS",
  "FASTTRACK_PROTOTYPE_ENABLED",
  "FASTTRACK_BASE_URL",
  "FASTTRACK_MAX_MEETINGS",
  "NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA",
  "NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT",
  "REALTIME_CHANNEL_SECRET",
  "ACTOR_CONVERSATION_MULTIPLEX_ENABLED",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "NEXT_PUBLIC_LIVEKIT_URL",
  "MEDIA_SCAN_MODE",
  "MEDIA_CLAMSCAN_BIN",
  "MEDIA_FRESHCLAM_BIN",
  "MEDIA_CLAMAV_DATABASE",
  "MEDIA_CLAMSCAN_TIMEOUT_MS",
  "MEDIA_FRESHCLAM_TIMEOUT_MS",
  "MEDIA_CLAMAV_REFRESH_INTERVAL_MS",
  "MEDIA_CLAMAV_MAX_DEFINITION_AGE_MS",
  "NOTIFICATION_WEBHOOK_URL",
  "NOTIFICATION_WEBHOOK_SECRET",
  "NOTIFICATION_DELIVERY_MAX_ATTEMPTS",
];

const optionalDatabaseUrlNames = ["DATABASE_IMPORT_URL", "DIRECT_URL"];
const productionFalseFlags = [
  "FASTTRACK_PROTOTYPE_ENABLED",
  "NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA",
  "NEXT_PUBLIC_ENABLE_DEMO_ACCOUNT",
];

const failures: string[] = [];

for (const spec of specs) {
  if (spec.productionOnly && !production) continue;

  const rawValue = firstRawValue(spec.names);
  if (!rawValue) {
    failures.push(`${spec.names.join(" or ")} missing (${spec.description})`);
    continue;
  }

  const value = rawValue.trim();
  if (rawValue !== value) {
    failures.push(`${spec.names.join(" or ")} must not contain leading or trailing whitespace`);
    continue;
  }

  if (!ci && looksLikePlaceholder(value)) {
    failures.push(`${spec.names.join(" or ")} still looks like a placeholder`);
    continue;
  }

  const validationError = spec.validate?.(value);
  if (validationError) {
    failures.push(`${spec.names.join(" or ")} ${validationError}`);
  }
}

for (const name of optionalDatabaseUrlNames) {
  const value = process.env[name]?.trim();
  if (!value) continue;

  const validationError = databaseUrlConfigurationError(value, {
    production,
  });
  if (validationError) {
    failures.push(`${name} ${validationError}`);
  }
}

try {
  resolveNotificationWebhookConfig();
} catch (error) {
  failures.push(
    error instanceof Error ? error.message : "notification.webhook_invalid_config",
  );
}

if (production) {
  for (const name of productionFalseFlags) {
    if (process.env[name]?.trim().toLowerCase() === "true") {
      failures.push(`${name} must be false or unset in production`);
    }
  }
}

if (failures.length > 0) {
  console.error("Environment gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const presentOptional = optional.filter((name) => Boolean(process.env[name]));
console.log(
  [
    "Environment gate passed.",
    `Mode: ${production ? "production" : "development"}`,
    `Optional values present: ${presentOptional.length ? presentOptional.join(", ") : "none"}`,
  ].join("\n")
);

function firstRawValue(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return null;
}

function validateUrl(value: string) {
  try {
    new URL(value);
    return null;
  } catch {
    return "must be a valid URL";
  }
}

function validateDatabaseUrl(value: string) {
  return databaseUrlConfigurationError(value, { production, required: true });
}

function validateWorkosClientId(value: string) {
  return value.startsWith("client_")
    ? null
    : "must be a WorkOS client id starting with client_";
}

function looksLikePlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("your_") ||
    normalized.includes("your-") ||
    normalized.includes("<") ||
    normalized.includes("***") ||
    normalized.includes("generate-with")
  );
}
