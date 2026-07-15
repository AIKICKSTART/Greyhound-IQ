export const SUPPLY_CHAIN_REVIEW_SCHEMA_VERSION = 1 as const;
export const SUPPLY_CHAIN_REVIEW_MAX_AGE_DAYS = 31;
export const PACKAGE_MAINTENANCE_MAX_AGE_DAYS = 730;

export const REVIEWED_ROOT_POSTINSTALL = "prisma generate";

export const REVIEWED_LIFECYCLE_SCRIPTS = [
  {
    name: "@prisma/client",
    version: "6.19.3",
    hooks: { postinstall: "node scripts/postinstall.js" },
    decision:
      "Required build-time Prisma Client generation; writes generated client files and invokes the pinned Prisma CLI.",
  },
  {
    name: "@prisma/engines",
    version: "6.19.3",
    hooks: { postinstall: "node scripts/postinstall.js" },
    decision:
      "Required pinned platform-engine preparation; package bytes remain registry and SHA-512 locked.",
  },
  {
    name: "@scarf/scarf",
    version: "1.4.0",
    hooks: { postinstall: "node ./report.js" },
    decision:
      "Network-capable install analytics are accepted only while root scarfSettings.enabled is false and policy-enforced.",
  },
  {
    name: "esbuild",
    version: "0.28.1",
    hooks: { postinstall: "node install.js" },
    decision:
      "Required build tool verifies its platform binary version and binary hash; exact package artifact is lock-pinned.",
  },
  {
    name: "fsevents",
    version: "2.3.3",
    hooks: { install: "node-gyp rebuild" },
    decision:
      "Optional Darwin-only native watcher dependency; it is absent on Windows and not part of the Linux production runtime.",
  },
  {
    name: "prisma",
    version: "6.19.3",
    hooks: { preinstall: "node scripts/preinstall-entry.js" },
    decision:
      "Required build and migration CLI performs its supported-runtime preinstall check; exact artifact is lock-pinned.",
  },
  {
    name: "sharp",
    version: "0.34.5",
    hooks: { install: "node install/check.js || npm run build" },
    decision:
      "Required Next.js image dependency checks the pinned native package and only builds when no suitable binary exists.",
  },
  {
    name: "unrs-resolver",
    version: "1.12.2",
    hooks: { postinstall: "node postinstall.js" },
    decision:
      "Required resolver native-binding preparation delegates to napi-postinstall; exact package artifact is lock-pinned.",
  },
] as const;

export const RUNTIME_DEPENDENCY_CLASSIFICATION = {
  runtime: [
    "@base-ui/react",
    "@hookform/resolvers",
    "@prisma/client",
    "@supabase/ssr",
    "@supabase/supabase-js",
    "@workos-inc/authkit-nextjs",
    "@workos-inc/node",
    "class-variance-authority",
    "clsx",
    "date-fns",
    "hls.js",
    "livekit-client",
    "livekit-server-sdk",
    "lucide-react",
    "motion",
    "next",
    "react",
    "react-dom",
    "react-hook-form",
    "server-only",
    "stripe",
    "tailwind-merge",
    "undici",
    "zod",
  ],
  buildOrOperationsOnly: ["@next/env", "prisma", "tsx"],
  unused: ["@auth/prisma-adapter", "next-auth"],
} as const;

export const APPROVED_STABLE_PACKAGE_EXCEPTIONS = {
  "server-only":
    "The 0.0.1 sentinel is the framework-supported server-boundary marker and intentionally has no release cadence.",
  clsx:
    "The small stable class-name utility remains current at 2.1.1; age alone does not indicate abandonment.",
  "@stoplight/spectral-owasp-ruleset":
    "The current 2.0.1 ruleset is development-only and retained for the fail-closed OpenAPI static audit.",
} as const;

export const REVIEWED_DEPRECATED_TRANSITIVE_PACKAGES = [
  {
    name: "glob",
    version: "7.2.3",
    disposition:
      "Development-only transitive dependency of the Spectral ruleset bundler; replace when Stoplight releases the upstream chain.",
  },
  {
    name: "inflight",
    version: "1.0.6",
    disposition:
      "Development-only transitive dependency beneath glob 7 in the Spectral toolchain; never included in the standalone runtime image.",
  },
  {
    name: "sourcemap-codec",
    version: "1.4.8",
    disposition:
      "Development-only transitive dependency of the Spectral ruleset bundler; tracked until the upstream bundler replaces it.",
  },
] as const;

export const INTERNAL_PACKAGE_PUBLISHING_JUSTIFICATION =
  "GreyhoundIQ is one private npm package with no workspaces, publishConfig, local package links or internal package namespace, so there is no internal package publishing path to secure.";
