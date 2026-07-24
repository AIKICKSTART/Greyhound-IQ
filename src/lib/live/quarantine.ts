import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { withDbSystemContext } from "@/lib/db-context";

export const LIVE_FEED_QUARANTINE_MAX_EVIDENCE_BYTES = 16_384;

const MAX_EVIDENCE_DEPTH = 4;
const MAX_EVIDENCE_NODES = 40;
const MAX_EVIDENCE_KEY_BYTES = 64;
const MAX_EVIDENCE_STRING_BYTES = 256;
const REDACTED = "[REDACTED]";
const TRUNCATED = "[TRUNCATED]";
const CLASSIFICATIONS = new Set(["invalid", "incomplete", "conflict"]);
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PROVIDER_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const ENTITY_KIND_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const REASON_CODE_PATTERN = /^[a-z][a-z0-9._-]{0,99}$/;
const SENSITIVE_KEY_WORDS = new Set([
  "authorization",
  "cookie",
  "credential",
  "password",
  "passwd",
  "passphrase",
  "secret",
  "signature",
  "token",
  "cvc",
  "cvv",
]);

export type LiveFeedQuarantineClassification =
  "invalid" | "incomplete" | "conflict";

export type LiveFeedQuarantineInput = {
  observedAt?: Date;
  provider: string;
  entityKind: string;
  sourceId?: string | null;
  naturalIdentity?: string | null;
  reasonCode: string;
  classification: LiveFeedQuarantineClassification;
  evidence: Record<string, unknown>;
};

export type LiveFeedQuarantineOccurrence = {
  id: string;
  observedAt: Date;
  provider: string;
  entityKind: string;
  sourceId: string | null;
  naturalIdentity: string | null;
  reasonCode: string;
  classification: LiveFeedQuarantineClassification;
  evidenceSha256: string;
  evidenceJson: string;
};

export function createLiveFeedQuarantineOccurrence(
  input: LiveFeedQuarantineInput,
  overrides: { id?: string } = {},
): LiveFeedQuarantineOccurrence {
  const id = overrides.id ?? randomUUID();
  const observedAt = input.observedAt ?? new Date();
  const provider = normalizeToken(
    input.provider,
    PROVIDER_PATTERN,
    "live_feed_quarantine.invalid_provider",
  );
  const entityKind = normalizeToken(
    input.entityKind,
    ENTITY_KIND_PATTERN,
    "live_feed_quarantine.invalid_entity_kind",
  );
  const reasonCode = normalizeToken(
    input.reasonCode,
    REASON_CODE_PATTERN,
    "live_feed_quarantine.invalid_reason_code",
  );

  if (!UUID_V4_PATTERN.test(id)) {
    throw new Error("live_feed_quarantine.invalid_id");
  }
  assertObservedAt(observedAt);
  if (!CLASSIFICATIONS.has(input.classification)) {
    throw new Error("live_feed_quarantine.invalid_classification");
  }
  if (
    !input.evidence ||
    Array.isArray(input.evidence) ||
    typeof input.evidence !== "object"
  ) {
    throw new Error("live_feed_quarantine.invalid_evidence");
  }

  let evidenceJson = JSON.stringify(sanitizeEvidenceObject(input.evidence));
  const evidenceBytes = Buffer.byteLength(evidenceJson);
  if (evidenceBytes > LIVE_FEED_QUARANTINE_MAX_EVIDENCE_BYTES) {
    evidenceJson = JSON.stringify({
      _quarantineTruncated: true,
      sanitizedEvidenceBytes: evidenceBytes,
      sanitizedEvidenceSha256: sha256(evidenceJson),
    });
  }

  return {
    id,
    observedAt,
    provider,
    entityKind,
    sourceId: normalizeOptionalText(input.sourceId, 256),
    naturalIdentity: normalizeOptionalText(input.naturalIdentity, 512),
    reasonCode,
    classification: input.classification,
    evidenceSha256: sha256(evidenceJson),
    evidenceJson,
  };
}

// This intentionally opens its own system-context transaction. Call it after
// the canonical transaction resolves so rejected evidence survives rollback.
export async function writeLiveFeedQuarantine(input: LiveFeedQuarantineInput) {
  const [occurrence] = await writeLiveFeedQuarantines([input]);
  return occurrence;
}

export async function writeLiveFeedQuarantines(
  inputs: LiveFeedQuarantineInput[],
) {
  if (inputs.length === 0) return [];
  const occurrences = inputs.map((input) =>
    createLiveFeedQuarantineOccurrence(input),
  );
  const summaries = aggregateOccurrences(occurrences);
  await withDbSystemContext(async (tx) => {
    await tx.liveFeedQuarantine.createMany({ data: occurrences });
    for (let index = 0; index < summaries.length; index += 100) {
      const rows = summaries.slice(index, index + 100);
      await tx.$executeRaw`
        INSERT INTO "LiveFeedQuarantineSummary"
          ("id", "provider", "entityKind", "sourceId", "sourceKey",
           "naturalIdentity", "reasonCode", "classification", "evidenceSha256",
           "firstSeenAt", "lastSeenAt", "occurrenceCount", "reviewStatus",
           "createdAt", "updatedAt")
        VALUES ${Prisma.join(
          rows.map((row) => Prisma.sql`
            (${randomUUID()}, ${row.provider}, ${row.entityKind}, ${row.sourceId},
             ${row.sourceId ?? ""}, ${row.naturalIdentity}, ${row.reasonCode},
             ${row.classification}, ${row.evidenceSha256}, ${row.firstSeenAt},
             ${row.lastSeenAt}, ${row.occurrenceCount}, 'pending', NOW(), NOW())
          `),
        )}
        ON CONFLICT
          ("provider", "entityKind", "sourceKey", "reasonCode", "evidenceSha256")
        DO UPDATE SET
          "sourceId" = COALESCE(
            "LiveFeedQuarantineSummary"."sourceId",
            EXCLUDED."sourceId"
          ),
          "naturalIdentity" = COALESCE(
            EXCLUDED."naturalIdentity",
            "LiveFeedQuarantineSummary"."naturalIdentity"
          ),
          "classification" = EXCLUDED."classification",
          "firstSeenAt" = LEAST(
            "LiveFeedQuarantineSummary"."firstSeenAt",
            EXCLUDED."firstSeenAt"
          ),
          "lastSeenAt" = GREATEST(
            "LiveFeedQuarantineSummary"."lastSeenAt",
            EXCLUDED."lastSeenAt"
          ),
          "occurrenceCount" =
            "LiveFeedQuarantineSummary"."occurrenceCount"
            + EXCLUDED."occurrenceCount",
          "updatedAt" = NOW()
      `;
    }
  });
  return occurrences;
}

function aggregateOccurrences(occurrences: LiveFeedQuarantineOccurrence[]) {
  const summaries = new Map<
    string,
    LiveFeedQuarantineOccurrence & { occurrenceCount: bigint; firstSeenAt: Date; lastSeenAt: Date }
  >();
  for (const occurrence of occurrences) {
    const key = [
      occurrence.provider,
      occurrence.entityKind,
      occurrence.sourceId ?? "",
      occurrence.reasonCode,
      occurrence.evidenceSha256,
    ].join("\u0000");
    const existing = summaries.get(key);
    if (!existing) {
      summaries.set(key, {
        ...occurrence,
        occurrenceCount: BigInt(1),
        firstSeenAt: occurrence.observedAt,
        lastSeenAt: occurrence.observedAt,
      });
      continue;
    }
    existing.occurrenceCount += BigInt(1);
    if (occurrence.observedAt < existing.firstSeenAt) {
      existing.firstSeenAt = occurrence.observedAt;
    }
    if (occurrence.observedAt > existing.lastSeenAt) {
      existing.lastSeenAt = occurrence.observedAt;
    }
  }
  return [...summaries.values()];
}

function sanitizeEvidenceObject(value: Record<string, unknown>) {
  const sanitized = sanitizeEvidenceValue(
    value,
    0,
    { remaining: MAX_EVIDENCE_NODES },
    new WeakSet(),
  );
  return sanitized && !Array.isArray(sanitized) && typeof sanitized === "object"
    ? sanitized
    : { _unserializable: true };
}

function sanitizeEvidenceValue(
  value: unknown,
  depth: number,
  budget: { remaining: number },
  seen: WeakSet<object>,
): unknown {
  if (budget.remaining <= 0) return TRUNCATED;
  budget.remaining -= 1;
  if (value == null || typeof value === "boolean") return value;
  if (typeof value === "string") return sanitizeEvidenceText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: sanitizeEvidenceText(value.name),
      message: sanitizeEvidenceText(value.message),
    };
  }
  if (ArrayBuffer.isView(value)) return `[BINARY ${value.byteLength} BYTES]`;
  if (depth >= MAX_EVIDENCE_DEPTH) return TRUNCATED;
  if (seen.has(value)) return "[CIRCULAR]";

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      for (const entry of value) {
        if (budget.remaining <= 0) {
          result.push(TRUNCATED);
          break;
        }
        result.push(sanitizeEvidenceValue(entry, depth + 1, budget, seen));
      }
      return result;
    }

    const result: Record<string, unknown> = {};
    for (const key in value) {
      if (budget.remaining <= 0) {
        result._quarantineTruncated = true;
        break;
      }
      if (!Object.hasOwn(value, key)) {
        budget.remaining -= 1;
        continue;
      }
      if (!isSafeEvidenceKey(key) || isBlockedRacingKey(key)) {
        budget.remaining -= 1;
        continue;
      }
      if (isSensitiveKey(key)) {
        budget.remaining -= 1;
        result[key] = REDACTED;
        continue;
      }
      result[key] = sanitizeEvidenceValue(
        (value as Record<string, unknown>)[key],
        depth + 1,
        budget,
        seen,
      );
    }
    return result;
  } catch {
    return "[UNSERIALIZABLE]";
  } finally {
    seen.delete(value);
  }
}

function sanitizeEvidenceText(value: string) {
  return truncateUtf8(value, MAX_EVIDENCE_STRING_BYTES)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(
      /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g,
      REDACTED,
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi, REDACTED)
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi, `$1${REDACTED}@`)
    .replace(
      /((?:authorization|cookie|credential|password|passwd|passphrase|secret|token|api[-_ ]?key|signature)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      `$1${REDACTED}`,
    );
}

function isSafeEvidenceKey(key: string) {
  return (
    key !== "__proto__" &&
    key !== "prototype" &&
    key !== "constructor" &&
    key.length > 0 &&
    Buffer.byteLength(key) <= MAX_EVIDENCE_KEY_BYTES
  );
}

function isSensitiveKey(key: string) {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const compact = words.join("");
  return (
    words.some((word) => SENSITIVE_KEY_WORDS.has(word)) ||
    compact === "body" ||
    compact.endsWith("body") ||
    compact === "apikey" ||
    compact.endsWith("apikey") ||
    compact.endsWith("connectionstring") ||
    compact.endsWith("databaseurl") ||
    compact.endsWith("providerpayload") ||
    compact.endsWith("rawjson") ||
    compact.endsWith("rawpayload") ||
    compact.endsWith("rawresponse") ||
    compact.endsWith("rawhtml")
  );
}

function isBlockedRacingKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    normalized === "sp" ||
    normalized === "bsp" ||
    normalized.includes("odds") ||
    normalized.includes("startingprice") ||
    normalized.includes("dividend") ||
    /^(?:fixed|tote).+price$/.test(normalized)
  );
}

function normalizeToken(value: string, pattern: RegExp, errorCode: string) {
  if (typeof value !== "string") throw new Error(errorCode);
  const normalized = value.trim().toLowerCase();
  if (!pattern.test(normalized)) throw new Error(errorCode);
  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("live_feed_quarantine.invalid_identity");
  }
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new Error("live_feed_quarantine.invalid_identity");
  }
  return normalized;
}

function assertObservedAt(value: Date) {
  const time = value instanceof Date ? value.getTime() : Number.NaN;
  if (
    !Number.isFinite(time) ||
    time < Date.UTC(2000, 0, 1) ||
    time > Date.now() + 2 * 24 * 60 * 60 * 1_000
  ) {
    throw new Error("live_feed_quarantine.invalid_observed_at");
  }
}

function truncateUtf8(value: string, maxBytes: number) {
  if (Buffer.byteLength(value) <= maxBytes) return value;
  return Buffer.from(value)
    .subarray(0, maxBytes)
    .toString("utf8")
    .replace(/�$/, "");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
