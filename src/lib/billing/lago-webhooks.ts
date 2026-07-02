import "server-only";

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { Prisma } from "@prisma/client";

import { getLagoEnv } from "@/lib/billing/lago-env";
import { prisma } from "@/lib/db";

const LAGO_SIGNATURE_HEADER = "x-lago-signature";
const LAGO_SIGNATURE_ALGORITHM_HEADER = "x-lago-signature-algorithm";
const LAGO_UNIQUE_KEY_HEADER = "x-lago-unique-key";
const SUPPORTED_SIGNATURE_ALGORITHM = "hmac";

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

  if (!lagoEventId) {
    const event = await prisma.webhookEvent.create({
      data,
      select: eventSelect,
    });
    return { event, duplicate: false };
  }

  try {
    const event = await prisma.webhookEvent.create({
      data,
      select: eventSelect,
    });
    return { event, duplicate: false };
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err;

    const event = await incrementDuplicateWebhookEvent({
      eventType,
      lagoEventId,
      payloadHash,
    });
    return { event, duplicate: true };
  }
}

async function incrementDuplicateWebhookEvent({
  eventType,
  lagoEventId,
  payloadHash,
}: {
  eventType: string;
  lagoEventId: string | null;
  payloadHash: string;
}) {
  if (lagoEventId) {
    const existingById = await prisma.webhookEvent.findUnique({
      where: { lagoEventId },
      select: { id: true },
    });
    if (existingById) {
      return incrementWebhookRetryCount(existingById.id);
    }
  }

  const existing = await prisma.webhookEvent.findFirst({
    where: { provider: "lago", eventType, payloadHash },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("lago.webhook_duplicate_not_found");
  }

  return incrementWebhookRetryCount(existing.id);
}

function incrementWebhookRetryCount(id: string) {
  return prisma.webhookEvent.update({
    where: { id },
    data: { retryCount: { increment: 1 } },
    select: eventSelect,
  });
}

function verifyLagoWebhook(headers: Headers, rawBody: Buffer) {
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
