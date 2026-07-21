import assert from "node:assert/strict";

import {
  PROVIDER_RIGHTS_INVENTORY_SCHEMA_VERSION,
  PROVIDER_RIGHTS_REGISTRY_SCHEMA_VERSION,
  createProviderRightsReleaseAttestation,
  isProviderUseAuthorized,
  providerRightsSha256,
  validateProviderRightsInventory,
  validateProviderRightsRegistry,
  validateProviderRightsReleaseAttestation,
} from "./provider-rights";

const SOURCE_MANIFEST_SHA256 = "1".repeat(64);
const CONTRACT_DOCUMENT_SHA256 = "2".repeat(64);
const DUMP_MANIFEST_SHA256 = "3".repeat(64);
const DUMP_CHECKSUM_SHA256 = "4".repeat(64);
const SOURCE_COMMIT_SHA = "5".repeat(40);
const APPROVED_AT = "2026-07-18T08:00:00.000Z";
const CURRENT_TIME = new Date("2026-07-18T09:00:00.000Z");

const baseAuthorization = {
  grantId: "thedogs-production-2026",
  status: "approved" as const,
  providerKey: "thedogs",
  legalEntity: "Greyhound Racing New South Wales",
  dataScopes: ["replay_media", "race_results"],
  permissions: {
    ingestion: true,
    storage: true,
    normalization: true,
    display: true,
    analytics: true,
    replayRedistribution: true,
  },
  jurisdictions: ["NSW"],
  effectiveAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
  contractReference: "THEDOGS-2026-001",
  contractDocumentSha256: CONTRACT_DOCUMENT_SHA256,
  owner: "GreyhoundIQ data governance",
  retentionPolicyReference: "GIQ-RETENTION-001",
  attributionRequirement: "Display the approved provider attribution.",
};

const registry = {
  schemaVersion: PROVIDER_RIGHTS_REGISTRY_SCHEMA_VERSION,
  authorizations: [baseAuthorization],
};

const inventory = {
  schemaVersion: PROVIDER_RIGHTS_INVENTORY_SCHEMA_VERSION,
  sourceManifestSha256: SOURCE_MANIFEST_SHA256,
  generatedAt: "2026-07-18T07:30:00.000Z",
  entries: [
    {
      providerKey: "thedogs",
      dataScope: "race_results",
      jurisdiction: "NSW",
      requiredPermissions: [
        "ingestion",
        "storage",
        "normalization",
        "display",
        "analytics",
      ],
      rowCount: 45,
    },
    {
      providerKey: "thedogs",
      dataScope: "replay_media",
      jurisdiction: "NSW",
      requiredPermissions: [
        "ingestion",
        "storage",
        "normalization",
        "display",
        "analytics",
        "replayRedistribution",
      ],
      rowCount: 12,
    },
  ],
};

const releaseInput = {
  registry,
  inventory,
  releaseId: "production-cutover-20260718",
  database: "giq_production_candidate_20260716_r1",
  dumpManifestSha256: DUMP_MANIFEST_SHA256,
  dumpChecksumSha256: DUMP_CHECKSUM_SHA256,
  approvedAt: APPROVED_AT,
  sourceCommitSha: SOURCE_COMMIT_SHA,
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function expectRejected(callback: () => unknown, pattern: RegExp) {
  assert.throws(callback, pattern);
}

const attestation = createProviderRightsReleaseAttestation(
  releaseInput,
  CURRENT_TIME,
);
const reorderedInput = clone(releaseInput);
reorderedInput.registry.authorizations[0].dataScopes.reverse();
reorderedInput.inventory.entries.reverse();
for (const entry of reorderedInput.inventory.entries) {
  entry.requiredPermissions.reverse();
}
assert.deepEqual(
  createProviderRightsReleaseAttestation(reorderedInput, CURRENT_TIME),
  attestation,
  "equivalent input ordering must produce one deterministic attestation",
);
assert.equal(
  providerRightsSha256(attestation),
  providerRightsSha256(
    createProviderRightsReleaseAttestation(reorderedInput, CURRENT_TIME),
  ),
);
assert.equal(
  attestation.release.providerInventorySha256,
  providerRightsSha256(attestation.inventory),
);
assert.deepEqual(
  validateProviderRightsReleaseAttestation(attestation, { now: CURRENT_TIME }),
  attestation,
);
assert.equal(
  isProviderUseAuthorized(
    attestation,
    {
      providerKey: "thedogs",
      dataScope: "replay_media",
      jurisdiction: "NSW",
      requiredPermissions: ["display", "replayRedistribution"],
    },
    CURRENT_TIME,
  ),
  true,
);
assert.equal(
  isProviderUseAuthorized(
    attestation,
    {
      providerKey: "thedogs",
      dataScope: "replay_media",
      jurisdiction: "VIC",
      requiredPermissions: ["display", "replayRedistribution"],
    },
    CURRENT_TIME,
  ),
  false,
);

expectRejected(
  () =>
    createProviderRightsReleaseAttestation(
      {
        ...releaseInput,
        registry: {
          schemaVersion: PROVIDER_RIGHTS_REGISTRY_SCHEMA_VERSION,
          authorizations: [],
        },
      },
      CURRENT_TIME,
    ),
  /no current exact authorization covers/u,
);

for (const [field, value] of [
  ["providerKey", "*"],
  ["dataScope", "all-data"],
  ["jurisdiction", "ALL"],
] as const) {
  const changed = clone(inventory);
  Object.assign(changed.entries[0], { [field]: value });
  expectRejected(
    () => validateProviderRightsInventory(changed),
    /wildcard|exact lowercase|Invalid option/u,
  );
}

for (const field of ["providerKey", "dataScopes", "jurisdictions"] as const) {
  const changed = clone(registry);
  if (field === "providerKey") {
    changed.authorizations[0].providerKey = "topaz";
  } else if (field === "dataScopes") {
    changed.authorizations[0].dataScopes = ["race_cards"];
  } else {
    changed.authorizations[0].jurisdictions = ["VIC"];
  }
  expectRejected(
    () =>
      createProviderRightsReleaseAttestation(
        { ...releaseInput, registry: changed },
        CURRENT_TIME,
      ),
    /no current exact authorization covers/u,
  );
}

const futureRegistry = clone(registry);
futureRegistry.authorizations[0].effectiveAt = "2026-08-01T00:00:00.000Z";
expectRejected(
  () =>
    createProviderRightsReleaseAttestation(
      { ...releaseInput, registry: futureRegistry },
      CURRENT_TIME,
    ),
  /no current exact authorization covers/u,
);

const expiredRegistry = clone(registry);
expiredRegistry.authorizations[0].expiresAt = "2026-07-18T08:30:00.000Z";
expectRejected(
  () =>
    createProviderRightsReleaseAttestation(
      { ...releaseInput, registry: expiredRegistry },
      CURRENT_TIME,
    ),
  /provider rights current check/u,
);

const missingPermissionRegistry = clone(registry);
missingPermissionRegistry.authorizations[0].permissions.display = false;
expectRejected(
  () =>
    createProviderRightsReleaseAttestation(
      { ...releaseInput, registry: missingPermissionRegistry },
      CURRENT_TIME,
    ),
  /no current exact authorization covers/u,
);
const replayPermissionRegistry = clone(registry);
replayPermissionRegistry.authorizations[0].permissions.replayRedistribution = false;
expectRejected(
  () => validateProviderRightsRegistry(replayPermissionRegistry),
  /replayRedistribution/u,
);
const incompletePermissionRegistry = clone(registry) as unknown as {
  authorizations: Array<Record<string, unknown>>;
  schemaVersion: string;
};
delete (incompletePermissionRegistry.authorizations[0].permissions as Record<
  string,
  unknown
>).storage;
expectRejected(
  () => validateProviderRightsRegistry(incompletePermissionRegistry),
  /storage/u,
);

const replayWithoutRedistribution = clone(inventory);
replayWithoutRedistribution.entries[1].requiredPermissions = [
  "ingestion",
  "storage",
  "normalization",
  "display",
  "analytics",
];
expectRejected(
  () => validateProviderRightsInventory(replayWithoutRedistribution),
  /replayRedistribution/u,
);

const changedSourceHash = clone(attestation);
changedSourceHash.release.sourceManifestSha256 = "6".repeat(64);
expectRejected(
  () =>
    validateProviderRightsReleaseAttestation(changedSourceHash, {
      now: CURRENT_TIME,
    }),
  /source manifest hash does not match/u,
);
const changedInventoryHash = clone(attestation);
changedInventoryHash.release.providerInventorySha256 = "7".repeat(64);
expectRejected(
  () =>
    validateProviderRightsReleaseAttestation(changedInventoryHash, {
      now: CURRENT_TIME,
    }),
  /provider inventory hash does not match/u,
);
const futureInventory = clone(inventory);
futureInventory.generatedAt = "2026-07-18T08:30:00.000Z";
expectRejected(
  () =>
    createProviderRightsReleaseAttestation(
      { ...releaseInput, inventory: futureInventory },
      CURRENT_TIME,
    ),
  /inventory must be generated before approval/u,
);
expectRejected(
  () =>
    createProviderRightsReleaseAttestation(
      { ...releaseInput, dumpManifestSha256: "not-a-hash" },
      CURRENT_TIME,
    ),
  /lowercase SHA-256/u,
);

const registryWithApiKey = clone(registry) as unknown as Record<string, unknown>;
registryWithApiKey.apiKey = "must-not-be-accepted";
expectRejected(
  () => validateProviderRightsRegistry(registryWithApiKey),
  /Unrecognized key/u,
);
const registryWithContractContents = clone(registry) as unknown as {
  authorizations: Array<Record<string, unknown>>;
  schemaVersion: string;
};
registryWithContractContents.authorizations[0].contractContents = "secret text";
expectRejected(
  () => validateProviderRightsRegistry(registryWithContractContents),
  /Unrecognized key/u,
);

const previousEnvironment = {
  thedogs: process.env.THEDOGS_LICENSED_USE_APPROVED,
  topaz: process.env.TOPAZ_API_KEY,
  watchdog: process.env.WATCHDOG_PROVIDER_ENABLED,
};
try {
  process.env.THEDOGS_LICENSED_USE_APPROVED = "true";
  process.env.TOPAZ_API_KEY = "present-but-not-authorization";
  process.env.WATCHDOG_PROVIDER_ENABLED = "true";
  expectRejected(
    () =>
      createProviderRightsReleaseAttestation(
        {
          ...releaseInput,
          registry: {
            schemaVersion: PROVIDER_RIGHTS_REGISTRY_SCHEMA_VERSION,
            authorizations: [],
          },
        },
        CURRENT_TIME,
      ),
    /no current exact authorization covers/u,
  );
} finally {
  for (const [name, value] of [
    ["THEDOGS_LICENSED_USE_APPROVED", previousEnvironment.thedogs],
    ["TOPAZ_API_KEY", previousEnvironment.topaz],
    ["WATCHDOG_PROVIDER_ENABLED", previousEnvironment.watchdog],
  ] as const) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

console.log("provider rights validation tests passed");
