import { randomUUID } from "node:crypto";
import {
  CLOUD_TRACE_CONTEXT_HEADER,
  deriveRequestId,
  normalizeRequestId,
  normalizeTraceId,
  parseCloudTraceId,
} from "@/lib/request-id";

type LogContext = Record<string, unknown>;

export type LogCorrelationContext = Readonly<{
  requestId: string | null;
  traceId: string | null;
}>;

export const REQUESTLESS_LOG_CONTEXT: LogCorrelationContext = Object.freeze({
  requestId: null,
  traceId: null,
});

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 8;
const MAX_ENTRIES = 50;
const MAX_STRING_LENGTH = 2_048;
const MAX_MESSAGE_LENGTH = 8_192;
const SENSITIVE_KEY_WORDS = new Set([
  "authorization",
  "cookie",
  "credential",
  "password",
  "passwd",
  "passphrase",
  "signature",
  "secret",
  "token",
  "pan",
  "cvc",
  "cvv",
]);
const SENSITIVE_COMPACT_KEYS = [
  "authheader",
  "authenticationheader",
  "connectionstring",
  "databaseurl",
  "cardnumber",
  "primaryaccountnumber",
  "paymentcardnumber",
  "privatemessagebody",
  "uploadedfilecontent",
  "uploadedfilecontents",
  "sensitivefilecontent",
  "providerpayload",
  "rawproviderpayload",
  "webhookpayload",
];

export function logCorrelationContextFromHeaders(
  headers: Headers,
): LogCorrelationContext {
  const traceId = parseCloudTraceId(headers.get(CLOUD_TRACE_CONTEXT_HEADER));
  return {
    requestId: deriveRequestId(headers),
    traceId: traceId ?? null,
  };
}

// Request-only logging must retain a non-null correlation value even if a
// framework header lookup unexpectedly fails. The fallback UUID is a local
// correlation id only; it is never presented as a Cloud Trace id.
export async function getRequestLogContext(): Promise<LogCorrelationContext> {
  try {
    const { headers } = await import("next/headers");
    return logCorrelationContextFromHeaders(await headers());
  } catch {
    return { requestId: randomUUID(), traceId: null };
  }
}

// Mixed request/job code uses request metadata only inside the Next.js Node
// runtime. CLI jobs and tests remain explicitly requestless without importing
// or invoking a framework request API.
export async function getExecutionLogContext(): Promise<LogCorrelationContext> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return REQUESTLESS_LOG_CONTEXT;
  try {
    const { headers } = await import("next/headers");
    return logCorrelationContextFromHeaders(await headers());
  } catch {
    return REQUESTLESS_LOG_CONTEXT;
  }
}

// Backward-compatible scalar accessor for existing request-aware helpers while
// the correlation migration moves them to the complete request/trace context.
export async function getRequestId(): Promise<string | undefined> {
  return (await getExecutionLogContext()).requestId ?? undefined;
}

// One-line JSON to stdout/stderr. Cloud Run parses `severity`; an ERROR entry
// whose message contains a stack trace is auto-ingested by GCP Error Reporting.
// Never pass request bodies, tokens, or secrets in `context`.
export function logError(event: string, context?: LogContext, err?: unknown) {
  emit("ERROR", event, context, err);
}

export function logWarn(event: string, context?: LogContext, err?: unknown) {
  emit("WARNING", event, context, err);
}

export function logInfo(event: string, context?: LogContext, err?: unknown) {
  emit("INFO", event, context, err);
}

export async function logRequestError(
  event: string,
  context?: LogContext,
  err?: unknown,
) {
  emit("ERROR", event, await correlatedContextForRequest(context), err);
}

export async function logRequestWarn(
  event: string,
  context?: LogContext,
  err?: unknown,
) {
  emit("WARNING", event, await correlatedContextForRequest(context), err);
}

export async function logRequestInfo(
  event: string,
  context?: LogContext,
  err?: unknown,
) {
  emit("INFO", event, await correlatedContextForRequest(context), err);
}

export async function logExecutionError(
  event: string,
  context?: LogContext,
  err?: unknown,
) {
  emit("ERROR", event, await correlatedContextForExecution(context), err);
}

export async function logExecutionWarn(
  event: string,
  context?: LogContext,
  err?: unknown,
) {
  emit("WARNING", event, await correlatedContextForExecution(context), err);
}

export async function logExecutionInfo(
  event: string,
  context?: LogContext,
  err?: unknown,
) {
  emit("INFO", event, await correlatedContextForExecution(context), err);
}

export function logCorrelatedError(
  correlation: LogCorrelationContext,
  event: string,
  context?: LogContext,
  err?: unknown,
) {
  emit("ERROR", event, correlatedContext(correlation, context), err);
}

export function logCorrelatedWarn(
  correlation: LogCorrelationContext,
  event: string,
  context?: LogContext,
  err?: unknown,
) {
  emit("WARNING", event, correlatedContext(correlation, context), err);
}

export function logCorrelatedInfo(
  correlation: LogCorrelationContext,
  event: string,
  context?: LogContext,
  err?: unknown,
) {
  emit("INFO", event, correlatedContext(correlation, context), err);
}

export function logBackgroundError(
  event: string,
  context?: LogContext,
  err?: unknown,
) {
  emit(
    "ERROR",
    event,
    correlatedContext(REQUESTLESS_LOG_CONTEXT, context),
    err,
  );
}

export function logBackgroundWarn(
  event: string,
  context?: LogContext,
  err?: unknown,
) {
  emit(
    "WARNING",
    event,
    correlatedContext(REQUESTLESS_LOG_CONTEXT, context),
    err,
  );
}

function emit(
  severity: "ERROR" | "WARNING" | "INFO",
  event: string,
  context?: LogContext,
  err?: unknown,
) {
  const safeContext = sanitizeContext(context);
  const eventName = safeLabel(event, "log.unnamed");
  const detail = safeErrorText(err);
  const requestId = normalizeRequestId(stringValue(context?.requestId));
  const traceId = normalizeTraceId(stringValue(context?.traceId));
  const actorId = safeOptionalIdentifier(
    stringValue(context?.actorId) ?? stringValue(context?.userId),
  );
  const tenantId = safeOptionalIdentifier(
    stringValue(context?.tenantId) ?? stringValue(context?.organizationId),
  );
  const targetType = safeOptionalLabel(stringValue(context?.targetType));
  const targetId = safeOptionalIdentifier(stringValue(context?.targetId));
  const outcome = safeOptionalLabel(stringValue(context?.outcome));
  const errorClass = safeOptionalLabel(
    stringValue(context?.errorClass) ??
      stringValue(context?.errorClassification) ??
      stringValue(context?.errorCode),
  );
  const durationMs = safeDurationMs(context?.durationMs ?? context?.duration);
  const securityMetadata = sanitizeValue(
    context?.securityMetadata ?? context?.security,
    0,
    new WeakSet(),
  );
  const line = JSON.stringify({
    ...safeContext,
    timestamp: new Date().toISOString(),
    severity,
    message: detail ? `${eventName}: ${detail}` : eventName,
    event: eventName,
    service: safeLabel(
      stringValue(context?.service) ?? process.env.K_SERVICE,
      "greyhoundiq-web",
    ),
    environment: safeLabel(
      stringValue(context?.environment) ??
        process.env.GREYHOUNDIQ_ENV ??
        process.env.VERCEL_ENV ??
        process.env.NODE_ENV,
      "unknown",
    ),
    region: safeLabel(
      stringValue(context?.region) ??
        process.env.GOOGLE_CLOUD_REGION ??
        process.env.GCP_REGION ??
        process.env.REGION,
      "unknown",
    ),
    revision: safeLabel(
      stringValue(context?.revision) ??
        process.env.K_REVISION ??
        process.env.GITHUB_SHA,
      "unknown",
    ),
    requestId: requestId ?? null,
    traceId: traceId ?? null,
    actorId,
    tenantId,
    targetType,
    targetId,
    outcome,
    errorClass,
    durationMs,
    securityMetadata: securityMetadata ?? null,
  });
  try {
    if (severity === "ERROR") console.error(line);
    else if (severity === "WARNING") console.warn(line);
    else console.info(line);
  } catch {
    // A diagnostic sink must not replace the application result with its own
    // exception. The already-sanitized JSON line gets one bounded stderr
    // fallback; a broken process stream is then left to platform health checks.
    try {
      process.stderr.write(`${line}\n`);
    } catch {
      // Both local sinks are unavailable. Never recurse into this logger.
    }
  }
}

async function correlatedContextForRequest(context: LogContext | undefined) {
  return correlatedContext(await getRequestLogContext(), context);
}

async function correlatedContextForExecution(context: LogContext | undefined) {
  return correlatedContext(await getExecutionLogContext(), context);
}

function correlatedContext(
  correlation: LogCorrelationContext,
  context: LogContext | undefined,
) {
  return {
    ...context,
    requestId: normalizeRequestId(correlation.requestId) ?? null,
    traceId: normalizeTraceId(correlation.traceId) ?? null,
  };
}

function sanitizeContext(context: LogContext | undefined) {
  return (sanitizeValue(context ?? {}, 0, new WeakSet()) ?? {}) as Record<
    string,
    unknown
  >;
}

function sanitizeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value == null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return redactSensitiveText(truncate(value, MAX_STRING_LENGTH));
  }
  if (typeof value === "number")
    return Number.isFinite(value) ? value : String(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") return "[FUNCTION]";
  if (typeof value !== "object") {
    return redactSensitiveText(truncate(String(value), MAX_STRING_LENGTH));
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return safeErrorText(value);
  if (depth >= MAX_DEPTH) return "[MAX_DEPTH]";
  if (seen.has(value)) return "[CIRCULAR]";

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const items = value
        .slice(0, MAX_ENTRIES)
        .map((item) => sanitizeValue(item, depth + 1, seen));
      if (value.length > MAX_ENTRIES)
        items.push(`[${value.length - MAX_ENTRIES} MORE]`);
      return items;
    }

    const result: Record<string, unknown> = {};
    const entries = Object.entries(value).slice(0, MAX_ENTRIES);
    for (const [key, item] of entries) {
      result[key] = isSensitiveKey(key)
        ? REDACTED
        : sanitizeValue(item, depth + 1, seen);
    }
    if (Object.keys(value).length > MAX_ENTRIES) {
      result._truncated = `${Object.keys(value).length - MAX_ENTRIES} more fields`;
    }
    return result;
  } catch {
    return "[UNSERIALIZABLE]";
  } finally {
    seen.delete(value);
  }
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
    SENSITIVE_COMPACT_KEYS.some((suffix) => compact.endsWith(suffix)) ||
    compact === "body" ||
    compact.endsWith("body") ||
    compact === "apikey" ||
    compact.endsWith("apikey")
  );
}

function safeErrorText(err: unknown) {
  if (err === undefined) return null;
  const value =
    err instanceof Error
      ? (err.stack ?? err.message)
      : typeof err === "string"
        ? err
        : JSON.stringify(sanitizeValue(err, 0, new WeakSet()));
  return redactSensitiveText(
    truncate(value ?? String(err), MAX_MESSAGE_LENGTH),
  );
}

function redactSensitiveText(value: string) {
  return redactAssignments(
    value
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
      .replace(
        /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g,
        REDACTED,
      )
      .replace(
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi,
        REDACTED,
      )
      .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi, `$1${REDACTED}@`),
  );
}

function redactAssignments(value: string) {
  return value.replace(
    /((?:authorization|authentication[-_ ]?header|cookie|credential|password|passwd|passphrase|secret|token|api[-_ ]?key|(?:webhook[-_ ]?)?signature|(?:payment[-_ ]?)?card[-_ ]?(?:number|cvc|cvv)|primary[-_ ]?account[-_ ]?number|private[-_ ]?message[-_ ]?body|(?:uploaded|sensitive)[-_ ]?file[-_ ]?contents?|(?:raw[-_ ]?)?provider[-_ ]?payload|webhook[-_ ]?payload|pan|cvc|cvv)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
    `$1${REDACTED}`,
  );
}

function safeLabel(value: string | undefined, fallback: string) {
  const normalized = value
    ?.trim()
    .replace(/[\u0000-\u001f\u007f]/g, "_")
    .slice(0, 128);
  return normalized || fallback;
}

function safeOptionalLabel(value: string | undefined) {
  if (!value?.trim()) return null;
  return safeLabel(value, "unknown");
}

function safeOptionalIdentifier(value: string | undefined) {
  const normalized = value
    ?.trim()
    .replace(/[^A-Za-z0-9_.:@/-]/g, "_")
    .slice(0, 128);
  return normalized || null;
}

function safeDurationMs(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(value, Number.MAX_SAFE_INTEGER)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function truncate(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit)}…[TRUNCATED]` : value;
}
