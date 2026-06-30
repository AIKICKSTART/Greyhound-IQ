import { loadEnvConfig } from "@next/env";

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
    description: "Prisma Postgres connection string",
    validate: (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://")
        ? null
        : "must start with postgresql:// or postgres://",
  },
  {
    names: ["NEXTAUTH_URL"],
    description: "public app URL used by auth callbacks",
    productionOnly: true,
    validate: validateUrl,
  },
  {
    names: ["NEXTAUTH_SECRET", "AUTH_SECRET"],
    description: "server-side signing secret for sessions and media URLs",
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
    names: ["INTERNAL_API_SECRET", "INTERNAL_SECRET", "CRON_SECRET"],
    description: "shared secret for internal maintenance routes",
    productionOnly: true,
    validate: (value) =>
      value.length >= 32 ? null : "must be at least 32 characters",
  },
];

const optional = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "TOPAZ_API_KEY",
  "TOPAZ_API_BASE",
  "TOPAZ_OWNING_AUTHORITY_CODE",
  "TOPAZ_TIME_ZONE",
  "FASTTRACK_PROTOTYPE_ENABLED",
  "FASTTRACK_BASE_URL",
  "FASTTRACK_MAX_MEETINGS",
  "NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA",
];

const failures: string[] = [];

for (const spec of specs) {
  if (spec.productionOnly && !production) continue;

  const value = firstValue(spec.names);
  if (!value) {
    failures.push(`${spec.names.join(" or ")} missing (${spec.description})`);
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

function firstValue(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
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
