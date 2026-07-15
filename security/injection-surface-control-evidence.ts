export const VERIFIED_INJECTION_SURFACE_CONTROL_IDS = [
  "security.injection-prevention.prevent-log",
  "security.injection-prevention.prevent-path",
  "security.injection-prevention.prevent-xss",
  "security.injection-prevention.prevent-stored-xss",
  "security.injection-prevention.prevent-dom-xss",
  "security.injection-prevention.prevent-ssrf",
  "security.injection-prevention.prevent-redirect",
  "security.injection-prevention.prevent-url-scheme",
  "security.injection-prevention.prevent-html-markdown",
] as const;

export const NOT_APPLICABLE_INJECTION_SURFACE_CONTROL_IDS = [
  "security.injection-prevention.prevent-nosql",
  "security.injection-prevention.prevent-template",
  "security.injection-prevention.prevent-ldap",
  "security.injection-prevention.prevent-email-header",
  "security.injection-prevention.prevent-csv",
  "security.injection-prevention.prevent-graphql",
] as const;

const INJECTION_SURFACE_CONTROL_EVIDENCE = [
  "security/injection-surface-control-evidence.ts",
  "security/injection-surface-control-evidence.test.ts",
  "security/xss-surface-review.ts",
  "security/xss-surface-evidence.ts",
  "security/xss-surface-evidence.test.ts",
  "security/ssrf-control-evidence.ts",
  "security/ssrf-control-evidence.test.ts",
  "security/external-link-embed-evidence.ts",
  "security/external-link-embed-evidence.test.ts",
  "security/download-control-evidence.ts",
  "security/download-control-evidence.test.ts",
  "src/lib/logger.ts",
  "src/lib/logger.test.ts",
  "src/lib/workos-redirect.ts",
  "src/lib/workos-redirect.test.ts",
  "src/lib/media-service.test.ts",
  "package.json",
] as const;

const verified = (requirementId: string) => [
  requirementId,
  {
    status: "verified" as const,
    evidence: INJECTION_SURFACE_CONTROL_EVIDENCE,
  },
] as const;

const notApplicable = (
  requirementId: string,
  notApplicableJustification: string,
) => [
  requirementId,
  {
    status: "not-applicable-with-justification" as const,
    notApplicableJustification,
    evidence: INJECTION_SURFACE_CONTROL_EVIDENCE,
  },
] as const;

export const INJECTION_SURFACE_CONTROL_MASTER_EVIDENCE = Object.fromEntries([
  ...VERIFIED_INJECTION_SURFACE_CONTROL_IDS.map(verified),
  notApplicable(
    "security.injection-prevention.prevent-nosql",
    "The current production application has no MongoDB, Firestore, DynamoDB, Redis query language, or other client-controlled NoSQL query surface. A focused dependency, import, and runtime-route scan fails if a reviewed NoSQL surface is introduced.",
  ),
  notApplicable(
    "security.injection-prevention.prevent-template",
    "The current application uses compiled React and Next.js components and has no runtime EJS, Handlebars, Mustache, Nunjucks, Pug, Liquid, Eta, or user-selected server-template engine. Focused dependency and import scans fail before any dynamic template surface can be introduced without review.",
  ),
  notApplicable(
    "security.injection-prevention.prevent-ldap",
    "The current production application has no LDAP dependency, import, bind, search, or directory-query route. A focused dependency and import scan fails if LDAP is introduced.",
  ),
  notApplicable(
    "security.injection-prevention.prevent-email-header",
    "The current application records support and notification data but does not construct or send outbound email or SMTP messages, so no user-controlled email-header boundary exists. Focused dependency and import scans fail if an email delivery surface is introduced.",
  ),
  notApplicable(
    "security.injection-prevention.prevent-csv",
    "The current application export is JSON and no production route emits CSV media types or uses a CSV serializer. A focused dependency and route scan fails when a CSV surface is introduced so formula-escaping controls must be reviewed first.",
  ),
  notApplicable(
    "security.injection-prevention.prevent-graphql",
    "The current production application exposes Next.js HTTP route handlers, not a GraphQL endpoint, schema, resolver, or client. A focused dependency, import, and route-path scan fails if GraphQL is introduced.",
  ),
]);
