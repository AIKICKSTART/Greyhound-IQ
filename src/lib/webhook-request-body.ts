export const WEBHOOK_BODY_MAX_BYTES = 1024 * 1024;

type WebhookBodyErrorCode =
  | "webhook.content_length_invalid"
  | "webhook.payload_invalid"
  | "webhook.payload_too_large";

export class WebhookBodyError extends Error {
  constructor(
    readonly code: WebhookBodyErrorCode,
    readonly status: 400 | 413,
    readonly safeMessage: string,
  ) {
    super(code);
    this.name = "WebhookBodyError";
  }
}

export async function readBoundedWebhookBody(
  request: Request,
  maxBytes = WEBHOOK_BODY_MAX_BYTES,
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("webhook.invalid_body_limit");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw invalidContentLength();
    }
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes)) {
      throw invalidContentLength();
    }
    if (declaredBytes > maxBytes) {
      throw payloadTooLarge();
    }
  }

  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (value.byteLength > maxBytes - byteLength) {
        await reader.cancel().catch(() => undefined);
        throw payloadTooLarge();
      }
      byteLength += value.byteLength;
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof WebhookBodyError) throw error;
    throw new WebhookBodyError(
      "webhook.payload_invalid",
      400,
      "Invalid webhook payload",
    );
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readBoundedWebhookText(
  request: Request,
  maxBytes = WEBHOOK_BODY_MAX_BYTES,
) {
  const body = await readBoundedWebhookBody(request, maxBytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new WebhookBodyError(
      "webhook.payload_invalid",
      400,
      "Invalid webhook payload",
    );
  }
}

export function webhookBodyErrorResponse(error: unknown) {
  if (!(error instanceof WebhookBodyError)) return null;
  return Response.json(
    { error: { code: error.code, message: error.safeMessage } },
    {
      status: error.status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function invalidContentLength() {
  return new WebhookBodyError(
    "webhook.content_length_invalid",
    400,
    "Invalid Content-Length",
  );
}

function payloadTooLarge() {
  return new WebhookBodyError(
    "webhook.payload_too_large",
    413,
    "Webhook payload too large",
  );
}
