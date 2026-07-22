import { createHash } from "node:crypto";

export const INVENTORY_SCHEMA = "greyhoundiq.replay-production-inventory";
export const INVENTORY_VERSION = 1;
export const DATABASE_NAME = "giq_production_stage11_20260718_r2";
export const CUTOFF = "2006-01-01T00:00:00.000Z";
export const RUNTIME_CANDIDATE_LIMIT = 16;
export const STALE_AFTER_SECONDS = 30 * 24 * 60 * 60;

export const CLASSIFICATIONS = Object.freeze([
  "identity_conflict",
  "structurally_resolvable_unverified",
  "license_gated_unverified",
  "provider_resolvable_unverified",
  "stored_source_failure_only",
  "partial_source",
  "legacy_reference_unverified",
  "provider_discovery_unverified",
  "no_stored_replay_evidence",
]);

export function assertSafeContainerInspect(inspect, requestedName) {
  if (!inspect || typeof inspect !== "object") {
    throw new Error("Docker inspect did not return one container object");
  }
  if (inspect.Name !== `/${requestedName}`) {
    throw new Error("Docker resolved a different container name");
  }
  if (inspect.State?.Running !== true) {
    throw new Error("The explicitly named PostgreSQL container is not running");
  }
  if (inspect.HostConfig?.NetworkMode !== "none") {
    throw new Error("Refusing container: Docker NetworkMode must equal none");
  }

  const portBindings = inspect.HostConfig?.PortBindings ?? {};
  if (Object.keys(portBindings).length !== 0) {
    throw new Error("Refusing container: HostConfig contains port bindings");
  }

  const ports = inspect.NetworkSettings?.Ports ?? {};
  if (
    Object.entries(ports).some(
      ([, bindings]) => Array.isArray(bindings) ? bindings.length > 0 : bindings != null
    )
  ) {
    throw new Error("Refusing container: NetworkSettings contains published ports");
  }

  return {
    containerId: String(inspect.Id ?? ""),
    containerName: requestedName,
    image: String(inspect.Config?.Image ?? ""),
    networkMode: "none",
  };
}

export function calculateDiskProjection({ sourceTableBytes, raceCount, runnerCount, videoCount }) {
  if (!Number.isSafeInteger(sourceTableBytes) || sourceTableBytes <= 0) {
    throw new Error("Source-table byte projection is missing or unsafe");
  }
  if (!Number.isSafeInteger(raceCount) || raceCount <= 0) {
    throw new Error("Race-count projection is missing or unsafe");
  }
  for (const [label, count] of [["Runner", runnerCount], ["Video", videoCount]]) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`${label}-count projection is missing or unsafe`);
    }
  }

  const projectedArtifactBytes = Math.ceil(
    Math.max(
      sourceTableBytes * 2,
      raceCount * 4096 + runnerCount * 2048 + videoCount * 4096
    )
  );
  const requiredFreeBytes = Math.ceil(
    projectedArtifactBytes * 1.25 + 512 * 1024 * 1024
  );
  if (!Number.isSafeInteger(projectedArtifactBytes) || !Number.isSafeInteger(requiredFreeBytes)) {
    throw new Error("Disk projection exceeds the safe integer range");
  }
  return { projectedArtifactBytes, requiredFreeBytes };
}

export function redactDiagnostic(value) {
  return String(value)
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-database-url]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .slice(0, 16_384);
}

export function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function emptyClassificationCounts() {
  return Object.fromEntries(CLASSIFICATIONS.map((name) => [name, 0]));
}
