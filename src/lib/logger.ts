import { REQUEST_ID_HEADER } from "@/lib/request-id";

type LogContext = Record<string, string | number | boolean | null | undefined>;

// Reads the per-request id the proxy stamped onto the forwarded request
// headers. Returns undefined outside a request scope (build, cron, module init)
// so callers can spread it into a log context without guarding. Kept out of
// `emit` because `headers()` is async and `emit` is a hot sync path — request
// contexts that want correlation pass `{ requestId: await getRequestId() }`.
export async function getRequestId(): Promise<string | undefined> {
  try {
    const { headers } = await import("next/headers");
    return (await headers()).get(REQUEST_ID_HEADER) ?? undefined;
  } catch {
    return undefined;
  }
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

function emit(
  severity: "ERROR" | "WARNING",
  event: string,
  context?: LogContext,
  err?: unknown
) {
  const stack = err instanceof Error ? err.stack : undefined;
  const detail =
    err === undefined ? null : err instanceof Error ? err.message : String(err);
  const line = JSON.stringify({
    severity,
    message: stack ? `${event}\n${stack}` : detail ? `${event}: ${detail}` : event,
    event,
    ...context,
  });
  if (severity === "ERROR") console.error(line);
  else console.warn(line);
}
