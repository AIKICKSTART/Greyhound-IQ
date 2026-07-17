export const USER_EXPORT_COLLECTION_LIMIT = 500;
export const USER_EXPORT_NESTED_COLLECTION_LIMIT = 20;
export const USER_EXPORT_MAX_BYTES = 8 * 1024 * 1024;
export const USER_EXPORT_CACHE_CONTROL = "private, no-store";

const FORBIDDEN_EXPORT_FIELDS = new Set([
  "stripeCustomerId",
  "stripeSubscriptionId",
  "workosUserId",
  "storageBucket",
  "storagePath",
  "publicUrl",
  "sha256",
  "metadataJson",
  "processingError",
  "processingAttempts",
  "processingStartedAt",
  "processingCompletedAt",
  "playbackPath",
  "posterPath",
  "hlsPath",
  "waveformJson",
  "captionPath",
  "inputJson",
  "outputJson",
  "toolInvocations",
  "createdMemoryIds",
  "harnessPid",
  "harnessSessionId",
]);

export function assertUserExportCollections(
  collections: Record<string, readonly unknown[]>,
  limit = USER_EXPORT_COLLECTION_LIMIT
) {
  for (const values of Object.values(collections)) {
    if (values.length > limit) throw new Error("export.too_large");
  }
}

export function assertUserExportDto(value: unknown) {
  visit(value);
}

export function assertUserExportSize(responseBody: string) {
  const sizeBytes = new TextEncoder().encode(responseBody).byteLength;
  if (sizeBytes > USER_EXPORT_MAX_BYTES) throw new Error("export.too_large");
  return sizeBytes;
}

function visit(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) visit(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_EXPORT_FIELDS.has(key)) {
      throw new Error("export.forbidden_field");
    }
    visit(child);
  }
}
