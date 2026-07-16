import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";

import { getLagoEnv } from "@/lib/billing/lago-env";
import { reduceLagoWebhook } from "@/lib/billing/lago-reducer";
import { withDbSystemContext } from "@/lib/db-context";

const LAGO_SIGNATURE_HEADER = "x-lago-signature";
const LAGO_SIGNATURE_ALGORITHM_HEADER = "x-lago-signature-algorithm";
const LAGO_UNIQUE_KEY_HEADER = "x-lago-unique-key";
const SUPPORTED_SIGNATURE_ALGORITHM = "hmac";
const LAGO_PROCESSING_LEASE_MS = 10 * 60 * 1000;

type IngestLagoWebhookInput = {
  headers: Headers;
  rawBody: Buffer;
};

type StoredWebhookEvent = {
  id: string;
  lagoEventId: string | null;
  eventType: string;
  status: string;
  retryCount: number;
};

export type IngestLagoWebhookResult = {
  event: StoredWebhookEvent;
  duplicate: boolean;
};

export class LagoWebhookError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 401 = 400
  ) {
    super(code);
  }
}

export async function ingestLagoWebhook({
  headers,
  rawBody,
}: IngestLagoWebhookInput): Promise<IngestLagoWebhookResult> {
  verifyLagoWebhook(headers, rawBody);

  const rawBodyText = rawBody.toString("utf8");
  const payload = parseJsonPayload(rawBodyText);
  const eventType = deriveLagoEventType(payload);
  const lagoEventId = cleanHeaderValue(headers.get(LAGO_UNIQUE_KEY_HEADER));
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const data = {
    provider: "lago",
    lagoEventId,
    eventType,
    status: "received",
    payloadHash,
    payloadJson: rawBodyText,
    headersJson: JSON.stringify(safeHeaders(headers)),
  };

  let duplicate = false;
  let event: StoredWebhookEvent;
  try {
    event = await withDbSystemContext((tx) =>
      tx.webhookEvent.create({ data, select: eventSelect })
    );
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err;
    duplicate = true;
    const existing = await findExistingLagoWebhook(lagoEventId, payloadHash);
    if (!existing) throw new Error("lago.webhook_duplicate_not_found");
    event = existing;
  }

  const processed = await processLagoWebhookReceipt({
    duplicate,
    event,
    eventType,
    lagoEventId,
    payloadJson: rawBodyText,
  });
  return { event: processed, duplicate };
}

async function findExistingLagoWebhook(
  lagoEventId: string | null,
  payloadHash: string
) {
  return withDbSystemContext(async (tx) => {
    if (lagoEventId) {
      const existingById = await tx.webhookEvent.findUnique({
        where: { lagoEventId },
        select: duplicateEventSelect,
      });
      if (existingById) {
        if (
          existingById.provider !== "lago" ||
          existingById.payloadHash !== payloadHash
        ) {
          throw new Error("lago.webhook_receipt_conflict");
        }
        return existingById;
      }
    }

    return tx.webhookEvent.findUnique({
      where: { provider_payloadHash: { provider: "lago", payloadHash } },
      select: duplicateEventSelect,
    });
  });
}

async function processLagoWebhookReceipt({
  duplicate,
  event,
  eventType,
  lagoEventId,
  payloadJson,
}: {
  duplicate: boolean;
  event: StoredWebhookEvent;
  eventType: string;
  lagoEventId: string | null;
  payloadJson: string;
}) {
  const leaseExpiredBefore = new Date(Date.now() - LAGO_PROCESSING_LEASE_MS);
  const processingToken = randomUUID();
  const claimed = await withDbSystemContext((tx) =>
    tx.webhookEvent.updateMany({
      where: {
        id: event.id,
        OR: [
          { status: { in: ["failed", "received"] } },
          { status: "processing", updatedAt: { lt: leaseExpiredBefore } },
        ],
      },
      data: {
        error: null,
        ...(duplicate ? { retryCount: { increment: 1 } } : {}),
        processingToken,
        status: "processing",
      },
    })
  );

  if (claimed.count === 0) {
    const current = await getStoredWebhookEvent(event.id);
    // Updating an active receipt would also refresh Prisma's @updatedAt field
    // and could keep a crashed processing lease alive forever. Count only
    // terminal duplicates; active work retains its original lease clock.
    return duplicate && current.status !== "processing"
      ? incrementWebhookRetryCount(event.id)
      : current;
  }

  try {
    await reduceLagoWebhook({
      webhookEventId: event.id,
      lagoEventId,
      eventType,
      payloadJson,
      processingToken,
    });
  } catch (err) {
    await markLagoWebhookFailed(event.id, processingToken, err);
    throw err;
  }

  return getStoredWebhookEvent(event.id);
}

function getStoredWebhookEvent(id: string) {
  return withDbSystemContext((tx) =>
    tx.webhookEvent.findUniqueOrThrow({ where: { id }, select: eventSelect })
  );
}

function incrementWebhookRetryCount(id: string) {
  return withDbSystemContext((tx) =>
    tx.webhookEvent.update({
      where: { id },
      data: { retryCount: { increment: 1 } },
      select: eventSelect,
    })
  );
}

function markLagoWebhookFailed(
  id: string,
  processingToken: string,
  err: unknown
) {
  return withDbSystemContext((tx) =>
    tx.webhookEvent.updateMany({
      where: { id, processingToken, status: "processing" },
      data: {
        error: summarizeError(err),
        processingToken: null,
        status: "failed",
      },
    })
  );
}

export function verifyLagoWebhook(headers: Headers, rawBody: Buffer) {
  const algorithm = cleanHeaderValue(headers.get(LAGO_SIGNATURE_ALGORITHM_HEADER));
  if (algorithm !== SUPPORTED_SIGNATURE_ALGORITHM) {
    throw new LagoWebhookError("lago.webhook_unsupported_signature_algorithm");
  }

  const signature = cleanHeaderValue(headers.get(LAGO_SIGNATURE_HEADER));
  if (!signature) {
    throw new LagoWebhookError("lago.webhook_missing_signature", 401);
  }

  let secret: string;
  try {
    secret = getLagoEnv().webhookSecret;
  } catch {
    throw new LagoWebhookError("lago.webhook_invalid_signature", 401);
  }

  if (!isValidHmacSignature(rawBody, secret, signature)) {
    throw new LagoWebhookError("lago.webhook_invalid_signature", 401);
  }
}

function isValidHmacSignature(rawBody: Buffer, secret: string, signature: string) {
  if (!looksLikeBase64(signature)) return false;

  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");
  const receivedBuffer = Buffer.from(signature, "base64");
  const expectedBuffer = Buffer.from(expected, "base64");

  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function parseJsonPayload(rawBody: string) {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new LagoWebhookError("lago.webhook_invalid_json");
  }
}

function deriveLagoEventType(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "unknown";
  }

  const record = payload as Record<string, unknown>;
  return (
    firstString(record.webhook_type) ??
    firstString(record.event_type) ??
    firstString(record.type) ??
    firstString(record.object_type) ??
    "unknown"
  );
}

function safeHeaders(headers: Headers) {
  const safe: Record<string, string> = {};

  addSafeHeader(safe, "content-type", headers.get("content-type"));
  addSafeHeader(
    safe,
    LAGO_SIGNATURE_ALGORITHM_HEADER,
    headers.get(LAGO_SIGNATURE_ALGORITHM_HEADER)
  );
  addSafeHeader(safe, LAGO_UNIQUE_KEY_HEADER, headers.get(LAGO_UNIQUE_KEY_HEADER));

  return safe;
}

function cleanHeaderValue(value: string | null) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function addSafeHeader(
  target: Record<string, string>,
  key: string,
  value: string | null
) {
  const cleaned = cleanHeaderValue(value);
  if (cleaned) target[key] = cleaned;
}

function firstString(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function looksLikeBase64(value: string) {
  return value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function summarizeError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/\s+/g, " ").slice(0, 500);
}

function isUniqueConstraintError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

const eventSelect = {
  id: true,
  lagoEventId: true,
  eventType: true,
  status: true,
  retryCount: true,
} as const;

const duplicateEventSelect = {
  ...eventSelect,
  payloadHash: true,
  provider: true,
} as const;
