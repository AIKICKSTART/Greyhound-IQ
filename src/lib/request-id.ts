export const REQUEST_ID_HEADER = "x-request-id";
export const CLOUD_TRACE_CONTEXT_HEADER = "x-cloud-trace-context";

const MAX_REQUEST_ID_LENGTH = 128;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const CLOUD_TRACE_CONTEXT =
  /^([0-9a-f]{32})(?:\/[0-9]+)?(?:;o=[01])?$/i;
const TRACE_ID = /^[0-9a-f]{32}$/i;

// Create the request ID at GreyhoundIQ's own proxy boundary. Upstream request
// and trace headers are propagation metadata, not trusted request identities.
export function createRequestId(): string {
  return crypto.randomUUID();
}

// Downstream handlers retain the normalized ID that Proxy injected. Direct
// handler execution (for example a unit test) still gets a local UUID.
export function deriveRequestId(headers: Headers): string {
  const existing = normalizeRequestId(headers.get(REQUEST_ID_HEADER));
  if (existing) return existing;

  return createRequestId();
}

export function normalizeRequestId(
  value: string | null | undefined
): string | undefined {
  const normalized = value?.trim();
  if (
    !normalized ||
    normalized.length > MAX_REQUEST_ID_LENGTH ||
    !REQUEST_ID.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

export function normalizeTraceId(
  value: string | null | undefined
): string | undefined {
  const normalized = value?.trim();
  return normalized && TRACE_ID.test(normalized)
    ? normalized.toLowerCase()
    : undefined;
}

export function parseCloudTraceId(
  value: string | null | undefined
): string | undefined {
  const match = value?.trim().match(CLOUD_TRACE_CONTEXT);
  return match ? match[1].toLowerCase() : undefined;
}
