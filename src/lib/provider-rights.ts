import { createHash } from "node:crypto";

import { z } from "zod";

export const PROVIDER_RIGHTS_REGISTRY_SCHEMA_VERSION =
  "giq-provider-rights-authorizations/v1" as const;
export const PROVIDER_RIGHTS_INVENTORY_SCHEMA_VERSION =
  "giq-provider-rights-inventory/v1" as const;
export const PROVIDER_RIGHTS_RELEASE_SCHEMA_VERSION =
  "giq-provider-rights-release/v1" as const;

export const PROVIDER_RIGHTS_PERMISSIONS = [
  "ingestion",
  "storage",
  "normalization",
  "display",
  "analytics",
  "replayRedistribution",
] as const;

export type ProviderRightsPermission =
  (typeof PROVIDER_RIGHTS_PERMISSIONS)[number];

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u, "must be a lowercase SHA-256");
const commitShaSchema = z
  .string()
  .regex(/^[0-9a-f]{40}$/u, "must be a full lowercase Git commit SHA");
const utcTimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
    "must be a canonical UTC timestamp",
  )
  .refine((value) => {
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
  }, "must be a real canonical UTC timestamp");
const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "must be a lowercase kebab-case identifier");
const databaseSchema = z
  .string()
  .trim()
  .min(1)
  .max(63)
  .regex(/^[a-z][a-z0-9_]*$/u, "must be a PostgreSQL database identifier");
const referenceSchema = z
  .string()
  .trim()
  .min(3)
  .max(128)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]+$/u,
    "must be an opaque reference, not a URL or file path",
  );
const conciseTextSchema = z.string().trim().min(1).max(200);
const attributionSchema = z.string().trim().min(1).max(500);

const forbiddenIdentifierTokens = new Set([
  "all",
  "any",
  "global",
  "unknown",
  "unattributed",
  "wildcard",
]);

function containsForbiddenIdentifierToken(value: string) {
  return value
    .split(/[-_]/u)
    .some((token) => forbiddenIdentifierTokens.has(token));
}

const providerKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/u,
    "must be an exact lowercase provider key",
  )
  .refine(
    (value) => !containsForbiddenIdentifierToken(value),
    "must not be a wildcard or unknown provider",
  );
const dataScopeSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/u,
    "must be an exact lowercase data scope",
  )
  .refine(
    (value) => !containsForbiddenIdentifierToken(value),
    "must not be a wildcard data scope",
  );
const jurisdictionSchema = z.enum([
  "ACT",
  "NSW",
  "NT",
  "QLD",
  "SA",
  "TAS",
  "VIC",
  "WA",
  "AUS",
]);
const permissionSchema = z.enum(PROVIDER_RIGHTS_PERMISSIONS);

function addDuplicateIssues(
  values: readonly string[],
  context: z.core.$RefinementCtx,
  label: string,
) {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value)) {
      context.addIssue({
        code: "custom",
        message: `${label} must not contain duplicates`,
        path: [index],
      });
    }
    seen.add(value);
  }
}

const dataScopesSchema = z
  .array(dataScopeSchema)
  .min(1)
  .max(64)
  .superRefine((values, context) => addDuplicateIssues(values, context, "dataScopes"));
const jurisdictionsSchema = z
  .array(jurisdictionSchema)
  .min(1)
  .max(9)
  .superRefine((values, context) => addDuplicateIssues(values, context, "jurisdictions"));
const requiredPermissionsSchema = z
  .array(permissionSchema)
  .min(1)
  .max(PROVIDER_RIGHTS_PERMISSIONS.length)
  .superRefine((values, context) =>
    addDuplicateIssues(values, context, "requiredPermissions"),
  );

const explicitPermissionsSchema = z
  .object({
    ingestion: z.boolean(),
    storage: z.boolean(),
    normalization: z.boolean(),
    display: z.boolean(),
    analytics: z.boolean(),
    replayRedistribution: z.boolean(),
  })
  .strict();

const providerAuthorizationSchema = z
  .object({
    grantId: identifierSchema,
    status: z.literal("approved"),
    providerKey: providerKeySchema,
    legalEntity: conciseTextSchema,
    dataScopes: dataScopesSchema,
    permissions: explicitPermissionsSchema,
    jurisdictions: jurisdictionsSchema,
    effectiveAt: utcTimestampSchema,
    expiresAt: utcTimestampSchema,
    contractReference: referenceSchema,
    contractDocumentSha256: sha256Schema,
    owner: conciseTextSchema,
    retentionPolicyReference: referenceSchema,
    attributionRequirement: attributionSchema,
  })
  .strict()
  .superRefine((authorization, context) => {
    if (Date.parse(authorization.expiresAt) <= Date.parse(authorization.effectiveAt)) {
      context.addIssue({
        code: "custom",
        message: "expiresAt must be after effectiveAt",
        path: ["expiresAt"],
      });
    }
    if (
      authorization.dataScopes.some((scope) => /^replay(?:[_-]|$)/u.test(scope)) &&
      authorization.permissions.replayRedistribution !== true
    ) {
      context.addIssue({
        code: "custom",
        message: "replay scopes require explicit replayRedistribution permission",
        path: ["permissions", "replayRedistribution"],
      });
    }
  });

const providerRightsRegistrySchema = z
  .object({
    schemaVersion: z.literal(PROVIDER_RIGHTS_REGISTRY_SCHEMA_VERSION),
    authorizations: z.array(providerAuthorizationSchema).max(256),
  })
  .strict()
  .superRefine((registry, context) => {
    addDuplicateIssues(
      registry.authorizations.map((authorization) => authorization.grantId),
      context,
      "grantId",
    );
  });

const providerRightsInventoryEntrySchema = z
  .object({
    providerKey: providerKeySchema,
    dataScope: dataScopeSchema,
    jurisdiction: jurisdictionSchema,
    requiredPermissions: requiredPermissionsSchema,
    rowCount: z.number().int().positive().safe(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (
      /^replay(?:[_-]|$)/u.test(entry.dataScope) &&
      !entry.requiredPermissions.includes("replayRedistribution")
    ) {
      context.addIssue({
        code: "custom",
        message: "replay scopes must require replayRedistribution",
        path: ["requiredPermissions"],
      });
    }
  });

const providerRightsInventorySchema = z
  .object({
    schemaVersion: z.literal(PROVIDER_RIGHTS_INVENTORY_SCHEMA_VERSION),
    sourceManifestSha256: sha256Schema,
    generatedAt: utcTimestampSchema,
    entries: z.array(providerRightsInventoryEntrySchema).min(1).max(4096),
  })
  .strict()
  .superRefine((inventory, context) => {
    addDuplicateIssues(
      inventory.entries.map((entry) =>
        [entry.providerKey, entry.dataScope, entry.jurisdiction].join("\u001f"),
      ),
      context,
      "provider/data-scope/jurisdiction tuple",
    );
  });

const providerRightsReleaseAttestationSchema = z
  .object({
    schemaVersion: z.literal(PROVIDER_RIGHTS_RELEASE_SCHEMA_VERSION),
    release: z
      .object({
        releaseId: identifierSchema,
        environment: z.literal("production"),
        database: databaseSchema,
        sourceManifestSha256: sha256Schema,
        providerInventorySha256: sha256Schema,
        dumpManifestSha256: sha256Schema,
        dumpChecksumSha256: sha256Schema,
      })
      .strict(),
    inventory: providerRightsInventorySchema,
    authorizations: z.array(providerAuthorizationSchema).max(256),
    review: z
      .object({
        approvedAt: utcTimestampSchema,
        sourceCommitSha: commitShaSchema,
      })
      .strict(),
  })
  .strict();

const providerUseSchema = z
  .object({
    providerKey: providerKeySchema,
    dataScope: dataScopeSchema,
    jurisdiction: jurisdictionSchema,
    requiredPermissions: requiredPermissionsSchema,
  })
  .strict();

export type ProviderAuthorization = z.infer<typeof providerAuthorizationSchema>;
export type ProviderRightsRegistry = z.infer<typeof providerRightsRegistrySchema>;
export type ProviderRightsInventoryEntry = z.infer<
  typeof providerRightsInventoryEntrySchema
>;
export type ProviderRightsInventory = z.infer<typeof providerRightsInventorySchema>;
export type ProviderRightsReleaseAttestation = z.infer<
  typeof providerRightsReleaseAttestationSchema
>;
export type ProviderUse = z.infer<typeof providerUseSchema>;

export class ProviderRightsValidationError extends Error {
  readonly findings: readonly string[];

  constructor(findings: readonly string[]) {
    super(findings.join("; "));
    this.name = "ProviderRightsValidationError";
    this.findings = findings;
  }
}

function parseStrict<T>(
  schema: z.ZodType<T>,
  value: unknown,
  label: string,
): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  throw new ProviderRightsValidationError(
    result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `.${issue.path.join(".")}` : "";
      return `${label}${path}: ${issue.message}`;
    }),
  );
}

function normalizedAuthorization(
  authorization: ProviderAuthorization,
): ProviderAuthorization {
  return {
    ...authorization,
    dataScopes: [...authorization.dataScopes].sort(compareText),
    jurisdictions: [...authorization.jurisdictions].sort(compareText),
  };
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function permissionRank(permission: ProviderRightsPermission) {
  return PROVIDER_RIGHTS_PERMISSIONS.indexOf(permission);
}

function normalizedInventoryEntry(
  entry: ProviderRightsInventoryEntry,
): ProviderRightsInventoryEntry {
  return {
    ...entry,
    requiredPermissions: [...entry.requiredPermissions].sort(
      (left, right) => permissionRank(left) - permissionRank(right),
    ),
  };
}

function compareInventoryEntries(
  left: ProviderRightsInventoryEntry,
  right: ProviderRightsInventoryEntry,
) {
  return (
    compareText(left.providerKey, right.providerKey) ||
    compareText(left.dataScope, right.dataScope) ||
    compareText(left.jurisdiction, right.jurisdiction)
  );
}

export function validateProviderRightsRegistry(
  value: unknown,
): ProviderRightsRegistry {
  const registry = parseStrict(
    providerRightsRegistrySchema,
    value,
    "provider rights registry",
  );
  return {
    schemaVersion: registry.schemaVersion,
    authorizations: registry.authorizations
      .map(normalizedAuthorization)
      .sort((left, right) => compareText(left.grantId, right.grantId)),
  };
}

export function validateProviderRightsInventory(
  value: unknown,
): ProviderRightsInventory {
  const inventory = parseStrict(
    providerRightsInventorySchema,
    value,
    "provider rights inventory",
  );
  return {
    ...inventory,
    entries: inventory.entries
      .map(normalizedInventoryEntry)
      .sort(compareInventoryEntries),
  };
}

function canonicalized(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalized);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, canonicalized(child)]),
    );
  }
  return value;
}

export function canonicalProviderRightsJson(value: unknown) {
  return JSON.stringify(canonicalized(value));
}

export function providerRightsSha256(value: unknown) {
  return createHash("sha256")
    .update(canonicalProviderRightsJson(value), "utf8")
    .digest("hex");
}

function authorizationCoversUse(
  authorization: ProviderAuthorization,
  use: ProviderUse,
  at: Date,
) {
  const atMilliseconds = at.getTime();
  return (
    authorization.status === "approved" &&
    authorization.providerKey === use.providerKey &&
    authorization.dataScopes.includes(use.dataScope) &&
    authorization.jurisdictions.includes(use.jurisdiction) &&
    atMilliseconds >= Date.parse(authorization.effectiveAt) &&
    atMilliseconds < Date.parse(authorization.expiresAt) &&
    use.requiredPermissions.every(
      (permission) => authorization.permissions[permission] === true,
    )
  );
}

function assertCompleteCoverage(
  authorizations: readonly ProviderAuthorization[],
  inventory: ProviderRightsInventory,
  at: Date,
  label: string,
) {
  if (Number.isNaN(at.getTime())) {
    throw new ProviderRightsValidationError([`${label}: invalid evaluation time`]);
  }

  const missing = inventory.entries.filter(
    (entry) =>
      !authorizations.some((authorization) =>
        authorizationCoversUse(authorization, entry, at),
      ),
  );
  if (missing.length > 0) {
    throw new ProviderRightsValidationError(
      missing.map(
        (entry) =>
          `${label}: no current exact authorization covers ${entry.providerKey}/${entry.dataScope}/${entry.jurisdiction} with ${entry.requiredPermissions.join(",")}`,
      ),
    );
  }
}

export interface CreateProviderRightsReleaseInput {
  registry: unknown;
  inventory: unknown;
  releaseId: string;
  database: string;
  dumpManifestSha256: string;
  dumpChecksumSha256: string;
  approvedAt: string;
  sourceCommitSha: string;
}

export function createProviderRightsReleaseAttestation(
  input: CreateProviderRightsReleaseInput,
  now = new Date(),
): ProviderRightsReleaseAttestation {
  const registry = validateProviderRightsRegistry(input.registry);
  const inventory = validateProviderRightsInventory(input.inventory);
  const candidate = {
    schemaVersion: PROVIDER_RIGHTS_RELEASE_SCHEMA_VERSION,
    release: {
      releaseId: input.releaseId,
      environment: "production" as const,
      database: input.database,
      sourceManifestSha256: inventory.sourceManifestSha256,
      providerInventorySha256: providerRightsSha256(inventory),
      dumpManifestSha256: input.dumpManifestSha256,
      dumpChecksumSha256: input.dumpChecksumSha256,
    },
    inventory,
    authorizations: registry.authorizations,
    review: {
      approvedAt: input.approvedAt,
      sourceCommitSha: input.sourceCommitSha,
    },
  };

  return validateProviderRightsReleaseAttestation(candidate, { now });
}

export function validateProviderRightsReleaseAttestation(
  value: unknown,
  options: { now?: Date } = {},
): ProviderRightsReleaseAttestation {
  const parsed = parseStrict(
    providerRightsReleaseAttestationSchema,
    value,
    "provider rights release attestation",
  );
  const inventory = validateProviderRightsInventory(parsed.inventory);
  const registry = validateProviderRightsRegistry({
    schemaVersion: PROVIDER_RIGHTS_REGISTRY_SCHEMA_VERSION,
    authorizations: parsed.authorizations,
  });
  const normalized: ProviderRightsReleaseAttestation = {
    ...parsed,
    inventory,
    authorizations: registry.authorizations,
  };
  const now = options.now ?? new Date();
  const approvedAt = new Date(normalized.review.approvedAt);
  const inventoryGeneratedAt = new Date(normalized.inventory.generatedAt);

  if (approvedAt.getTime() > now.getTime()) {
    throw new ProviderRightsValidationError([
      "provider rights release attestation: approvedAt must not be in the future",
    ]);
  }
  if (inventoryGeneratedAt.getTime() > approvedAt.getTime()) {
    throw new ProviderRightsValidationError([
      "provider rights release attestation: inventory must be generated before approval",
    ]);
  }
  if (
    normalized.release.sourceManifestSha256 !== inventory.sourceManifestSha256
  ) {
    throw new ProviderRightsValidationError([
      "provider rights release attestation: source manifest hash does not match the inventory",
    ]);
  }
  if (
    normalized.release.providerInventorySha256 !==
    providerRightsSha256(inventory)
  ) {
    throw new ProviderRightsValidationError([
      "provider rights release attestation: provider inventory hash does not match the embedded inventory",
    ]);
  }

  assertCompleteCoverage(
    normalized.authorizations,
    inventory,
    approvedAt,
    "provider rights approval",
  );
  assertCompleteCoverage(
    normalized.authorizations,
    inventory,
    now,
    "provider rights current check",
  );

  return normalized;
}

export function isProviderUseAuthorized(
  attestationValue: unknown,
  useValue: unknown,
  at = new Date(),
) {
  try {
    const attestation = validateProviderRightsReleaseAttestation(
      attestationValue,
      { now: at },
    );
    const use = parseStrict(providerUseSchema, useValue, "provider use");
    const inventoryEntry = attestation.inventory.entries.find(
      (entry) =>
        entry.providerKey === use.providerKey &&
        entry.dataScope === use.dataScope &&
        entry.jurisdiction === use.jurisdiction,
    );
    if (
      !inventoryEntry ||
      !use.requiredPermissions.every((permission) =>
        inventoryEntry.requiredPermissions.includes(permission),
      )
    ) {
      return false;
    }

    return attestation.authorizations.some((authorization) =>
      authorizationCoversUse(authorization, use, at),
    );
  } catch {
    return false;
  }
}

export function isProviderRegistryUseAuthorized(
  registryValue: unknown,
  useValue: unknown,
  at = new Date(),
) {
  try {
    const registry = validateProviderRightsRegistry(registryValue);
    const use = parseStrict(providerUseSchema, useValue, "provider use");
    return registry.authorizations.some((authorization) =>
      authorizationCoversUse(authorization, use, at),
    );
  } catch {
    return false;
  }
}
