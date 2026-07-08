export const REQUEST_ID_HEADER = "x-request-id";

// Prefer an id the load balancer already assigned so logs correlate end to end:
// a caller-supplied X-Request-ID, else the trace id from Cloud Run's
// X-Cloud-Trace-Context ("TRACE_ID/SPAN_ID;o=1"). Fall back to a fresh UUID.
export function deriveRequestId(headers: Headers): string {
  const existing = headers.get(REQUEST_ID_HEADER);
  if (existing) return existing;

  const trace = headers.get("x-cloud-trace-context");
  if (trace) {
    const traceId = trace.split("/")[0]?.trim();
    if (traceId) return traceId;
  }

  return crypto.randomUUID();
}
