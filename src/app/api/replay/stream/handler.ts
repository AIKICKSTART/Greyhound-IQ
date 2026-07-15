import { NextResponse } from "next/server";
import {
  proxiedStreamPath,
  validateReplayTarget,
  verifyStreamCapability,
} from "@/lib/live/replay-proxy";
import {
  fetchPinnedReplayOrigin,
  REPLAY_BODY_IDLE_TIMEOUT_MS,
  REPLAY_HEADER_TIMEOUT_MS,
} from "@/lib/live/replay-network";
import { checkLocalRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";
import { setSafeHttpHeader } from "@/lib/http-header-security";
import { getClientIp } from "@/lib/request-ip";

const MAX_UPSTREAM_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const REPLAY_RATE_LIMIT = 120;
const REPLAY_NO_IP_RATE_LIMIT = 30;
const REPLAY_RATE_LIMIT_WINDOW_MS = 60_000;
export const MAX_REPLAY_MANIFEST_BYTES = 1024 * 1024;
export const MAX_REPLAY_STREAM_BYTES = 200 * 1024 * 1024;
export const MAX_REPLAY_RANGE_HEADER_LENGTH = 128;
export const MAX_REPLAY_MANIFEST_LINES = 8 * 1024;
export const MAX_REPLAY_MANIFEST_URIS = 4 * 1024;
export const MAX_REPLAY_REWRITTEN_MANIFEST_BYTES = 2 * 1024 * 1024;
export const MAX_CONCURRENT_REPLAY_STREAMS = 8;
export const MAX_CONCURRENT_REPLAY_STREAMS_PER_CLIENT = 4;
export const MISSING_REPLAY_CLIENT_KEY = "missing-forwarded-for";
const REPLAY_MANIFEST_CONTENT_TYPES = new Set([
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "audio/mpegurl",
  "audio/x-mpegurl",
]);
const REPLAY_MEDIA_CONTENT_TYPES = new Set([
  "application/mp4",
  "application/octet-stream",
  "audio/aac",
  "audio/mp2t",
  "audio/mp4",
  "audio/mpeg",
  "video/iso.segment",
  "video/mp2t",
  "video/mp4",
  "video/mpeg",
]);
const REPLAY_RESPONSE_SECURITY_HEADERS = {
  "cache-control": "private, no-store",
  "cross-origin-resource-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
} as const;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export class ReplayStreamSemaphore {
  private active = 0;
  private readonly activeByClient = new Map<string, number>();

  constructor(
    readonly limit: number,
    readonly perClientLimit = limit,
  ) {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      !Number.isInteger(perClientLimit) ||
      perClientLimit < 1 ||
      perClientLimit > limit
    ) {
      throw new Error("replay.invalid_concurrency_limit");
    }
  }

  get activeCount() {
    return this.active;
  }

  activeCountFor(clientKey: string) {
    return this.activeByClient.get(clientKey) ?? 0;
  }

  tryAcquire(clientKey: string): (() => void) | null {
    if (
      !clientKey ||
      this.active >= this.limit ||
      this.activeCountFor(clientKey) >= this.perClientLimit
    ) {
      return null;
    }
    this.active += 1;
    this.activeByClient.set(clientKey, this.activeCountFor(clientKey) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      const clientActive = this.activeCountFor(clientKey) - 1;
      if (clientActive > 0) {
        this.activeByClient.set(clientKey, clientActive);
      } else {
        this.activeByClient.delete(clientKey);
      }
    };
  }
}

const replayStreamSemaphore = new ReplayStreamSemaphore(
  MAX_CONCURRENT_REPLAY_STREAMS,
  MAX_CONCURRENT_REPLAY_STREAMS_PER_CLIENT,
);

// Same-origin media relay. The provider URL is carried in an authenticated
// encrypted capability (see replay-proxy.ts), preventing an open relay while
// keeping provider query credentials out of ordinary request URLs.
export async function handleReplayStreamGet(request: Request) {
  const clientIp = getClientIp(request.headers);
  const clientKey = clientIp ?? MISSING_REPLAY_CLIENT_KEY;
  const limit = clientIp ? REPLAY_RATE_LIMIT : REPLAY_NO_IP_RATE_LIMIT;
  const rateLimit = checkLocalRateLimit(
    `replay:stream:${clientKey}`,
    limit,
    REPLAY_RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimit.allowed) {
    const response = rateLimitExceededResponse(rateLimit, limit, {
      code: "rate_limit.exceeded",
      message: "Too many replay requests",
    });
    setReplayResponseSecurityHeaders(response.headers);
    return response;
  }

  const params = new URL(request.url).searchParams;
  const target = verifyStreamCapability(params.get("t") ?? "");
  if (!target) {
    return replayJsonError("invalid stream token", 403);
  }

  return serveReplayTarget(request, target, { clientKey });
}

type ReplayFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

type ReplayRouteOptions = {
  fetchImpl?: ReplayFetch;
  semaphore?: ReplayStreamSemaphore;
  clientKey?: string;
  headerTimeoutMs?: number;
  bodyIdleTimeoutMs?: number;
};

export async function serveReplayTarget(
  request: Request,
  target: string,
  options: ReplayRouteOptions = {},
) {
  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? normalizeReplayRange(rangeHeader) : undefined;
  if (rangeHeader && !range) {
    return replayJsonError("invalid range", 416);
  }

  const headerTimeoutMs = options.headerTimeoutMs ?? REPLAY_HEADER_TIMEOUT_MS;
  const bodyIdleTimeoutMs = options.bodyIdleTimeoutMs ??
    REPLAY_BODY_IDLE_TIMEOUT_MS;
  if (
    !Number.isInteger(headerTimeoutMs) ||
    headerTimeoutMs < 1 ||
    !Number.isInteger(bodyIdleTimeoutMs) ||
    bodyIdleTimeoutMs < 1
  ) {
    throw new Error("replay.invalid_fetch_timeout");
  }

  const semaphore = options.semaphore ?? replayStreamSemaphore;
  const clientKey = options.clientKey ?? MISSING_REPLAY_CLIENT_KEY;
  const release = semaphore.tryAcquire(clientKey);
  if (!release) {
    return replayJsonError("replay capacity exhausted", 503, {
      "retry-after": "1",
    });
  }

  let upstream: Response;
  let resolvedTarget: string;
  const headerDeadline = new AbortController();
  const headerTimer = setTimeout(() => {
    headerDeadline.abort(new Error("replay.upstream_header_timeout"));
  }, headerTimeoutMs);
  const fetchSignal = AbortSignal.any([
    request.signal,
    headerDeadline.signal,
  ]);
  try {
    const result = await fetchReplayTarget(target, {
      cache: "no-store",
      signal: fetchSignal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "*/*",
        ...(range ? { range } : {}),
      },
    }, options.fetchImpl);
    upstream = result.response;
    resolvedTarget = result.target;
  } catch {
    release();
    return replayJsonError("upstream fetch failed", 502);
  } finally {
    clearTimeout(headerTimer);
  }

  if (!upstream.ok && upstream.status !== 206) {
    await cancelResponseBody(upstream);
    release();
    return replayJsonError("upstream error", 502);
  }

  const contentKind = classifyReplayContent(resolvedTarget, upstream);
  if (!contentKind) {
    await cancelResponseBody(upstream);
    release();
    return replayJsonError("unsupported upstream content type", 502);
  }

  if (contentKind === "manifest") {
    try {
      const manifest = await readBoundedText(
        upstream,
        MAX_REPLAY_MANIFEST_BYTES,
        request.signal,
        bodyIdleTimeoutMs,
      );
      const body = rewriteManifest(manifest, resolvedTarget);
      return new NextResponse(body, {
        status: 200,
        headers: {
          "content-type": "application/vnd.apple.mpegurl",
          ...replayResponseSecurityHeaders(),
        },
      });
    } catch {
      return replayJsonError("invalid upstream manifest", 502);
    } finally {
      release();
    }
  }

  // Segments / progressive mp4: stream bytes through, preserving range support.
  const declaredLength = responseContentLength(upstream);
  if (declaredLength !== null && declaredLength > MAX_REPLAY_STREAM_BYTES) {
    await cancelResponseBody(upstream);
    release();
    return replayJsonError("upstream response too large", 502);
  }
  if (!upstream.body) {
    release();
    return replayJsonError("upstream response missing", 502);
  }
  const headers = new Headers();
  copyHeader(upstream, headers, "content-type");
  copyHeader(upstream, headers, "content-length");
  copyHeader(upstream, headers, "content-range");
  copyHeader(upstream, headers, "accept-ranges");
  setReplayResponseSecurityHeaders(headers);
  return new NextResponse(
    boundResponseBody(upstream.body, MAX_REPLAY_STREAM_BYTES, {
      signal: request.signal,
      idleTimeoutMs: bodyIdleTimeoutMs,
      onFinalize: release,
    }),
    {
      status: upstream.status,
      headers,
    },
  );
}

export async function fetchReplayTarget(
  target: string,
  init: RequestInit,
  fetchImpl: ReplayFetch = fetchPinnedReplayOrigin,
  redirects = 0,
): Promise<{ response: Response; target: string }> {
  const current = validateReplayTarget(target);
  if (!current) {
    throw new Error("replay.fetch_target_not_allowed");
  }
  const canonicalTarget = current.toString();
  const response = await fetchImpl(canonicalTarget, {
    ...init,
    redirect: "manual",
  });
  if (!REDIRECT_STATUSES.has(response.status)) {
    return { response, target: canonicalTarget };
  }
  await cancelResponseBody(response);
  if (redirects >= MAX_UPSTREAM_REDIRECTS) {
    throw new Error("replay.redirect_limit_exceeded");
  }

  const location = response.headers.get("location");
  if (!location) {
    throw new Error("replay.redirect_location_missing");
  }

  let next: URL | null = null;
  try {
    next = validateReplayTarget(new URL(location, current));
  } catch {
    // Invalid redirect targets use the same fail-closed result as disallowed ones.
  }
  if (!next) {
    throw new Error("replay.redirect_target_not_allowed");
  }

  return fetchReplayTarget(next.toString(), init, fetchImpl, redirects + 1);
}

export async function readBoundedText(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal,
  idleTimeoutMs = REPLAY_BODY_IDLE_TIMEOUT_MS,
) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new Error("replay.invalid_response_limit");
  }
  const declaredLength = responseContentLength(response);
  if (declaredLength !== null && declaredLength > maxBytes) {
    await cancelResponseBody(response);
    throw new Error("replay.response_too_large");
  }
  if (!response.body) return "";

  const reader = boundResponseBody(response.body, maxBytes, {
    signal,
    idleTimeoutMs,
  }).getReader();
  const decoder = new TextDecoder();
  let result = "";
  let completed = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        completed = true;
        return result + decoder.decode();
      }
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined);
  }
}

type BoundedBodyOptions = {
  signal?: AbortSignal;
  idleTimeoutMs?: number;
  onFinalize?: () => void;
};

export function boundResponseBody(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  options: BoundedBodyOptions = {},
) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new Error("replay.invalid_response_limit");
  }
  const idleTimeoutMs = options.idleTimeoutMs ?? REPLAY_BODY_IDLE_TIMEOUT_MS;
  if (!Number.isInteger(idleTimeoutMs) || idleTimeoutMs < 1) {
    throw new Error("replay.invalid_body_idle_timeout");
  }
  const reader = body.getReader();
  let received = 0;
  let terminal = false;
  let finalized = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;

  const clearIdleTimer = () => {
    if (!idleTimer) return;
    clearTimeout(idleTimer);
    idleTimer = undefined;
  };

  const finalize = () => {
    if (finalized) return;
    finalized = true;
    clearIdleTimer();
    options.signal?.removeEventListener("abort", abort);
    try {
      options.onFinalize?.();
    } catch {
      // Resource release must remain best-effort and idempotent.
    }
  };

  const fail = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    reason: unknown,
  ) => {
    if (terminal) return;
    terminal = true;
    finalize();
    void reader.cancel(reason).catch(() => undefined);
    controller.error(reason);
  };

  const abort = () => {
    const reason = options.signal?.reason ?? new Error("replay.response_aborted");
    if (controllerRef) fail(controllerRef, reason);
  };

  const armIdleTimer = () => {
    clearIdleTimer();
    if (terminal) return;
    idleTimer = setTimeout(() => {
      if (controllerRef) {
        fail(controllerRef, new Error("replay.response_idle_timeout"));
      }
    }, idleTimeoutMs);
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      if (options.signal?.aborted) {
        abort();
        return;
      }
      options.signal?.addEventListener("abort", abort, { once: true });
      armIdleTimer();
    },
    async pull(controller) {
      if (terminal) return;
      try {
        const { done, value } = await reader.read();
        if (terminal) return;
        if (done) {
          terminal = true;
          finalize();
          controller.close();
          return;
        }
        received += value.byteLength;
        if (received > maxBytes) {
          fail(controller, new Error("replay.response_too_large"));
          return;
        }
        controller.enqueue(value);
        armIdleTimer();
      } catch (error) {
        fail(controller, error);
      }
    },
    async cancel(reason) {
      if (terminal) return;
      terminal = true;
      finalize();
      await reader.cancel(reason).catch(() => undefined);
    },
  });
}

export function classifyReplayContent(
  target: string,
  response: Response,
): "manifest" | "media" | null {
  const rawContentType = response.headers.get("content-type");
  if (!rawContentType) return null;
  const contentType = rawContentType.split(";", 1)[0].trim().toLowerCase();
  if (!contentType) return null;

  let manifestTarget = false;
  try {
    manifestTarget = new URL(target).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return null;
  }

  if (manifestTarget) {
    return REPLAY_MANIFEST_CONTENT_TYPES.has(contentType) ? "manifest" : null;
  }
  if (REPLAY_MANIFEST_CONTENT_TYPES.has(contentType)) return "manifest";
  return REPLAY_MEDIA_CONTENT_TYPES.has(contentType) ? "media" : null;
}

function replayResponseSecurityHeaders() {
  return REPLAY_RESPONSE_SECURITY_HEADERS;
}

function setReplayResponseSecurityHeaders(headers: Headers) {
  for (const [name, value] of Object.entries(REPLAY_RESPONSE_SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}

function replayJsonError(
  error: string,
  status: number,
  initialHeaders?: HeadersInit,
) {
  const headers = new Headers(initialHeaders);
  setReplayResponseSecurityHeaders(headers);
  return NextResponse.json({ error }, { status, headers });
}

export function normalizeReplayRange(value: string): string | null {
  if (value.length > MAX_REPLAY_RANGE_HEADER_LENGTH) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value);
  if (!match || (!match[1] && !match[2])) return null;

  const start = match[1] ? Number(match[1]) : null;
  const end = match[2] ? Number(match[2]) : null;
  if (
    (start !== null && !Number.isSafeInteger(start)) ||
    (end !== null && !Number.isSafeInteger(end))
  ) {
    return null;
  }

  if (start === null) {
    if (end === null || end < 1 || end > MAX_REPLAY_STREAM_BYTES) return null;
    return `bytes=-${end}`;
  }
  if (end === null) return `bytes=${start}-`;
  if (end < start || end - start + 1 > MAX_REPLAY_STREAM_BYTES) return null;
  return `bytes=${start}-${end}`;
}

export async function cancelResponseBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

function responseContentLength(response: Response) {
  const raw = response.headers.get("content-length");
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

// Rewrites every URI in an HLS playlist to route back through this proxy, so
// nested playlists and segments also stay same-origin. Relative URIs are
// resolved against the manifest URL first.
type ReplayManifestLimits = {
  maxLines?: number;
  maxUris?: number;
  maxOutputBytes?: number;
};

export function rewriteManifest(
  manifest: string,
  manifestUrl: string,
  limits: ReplayManifestLimits = {},
): string {
  const maxLines = limits.maxLines ?? MAX_REPLAY_MANIFEST_LINES;
  const maxUris = limits.maxUris ?? MAX_REPLAY_MANIFEST_URIS;
  const maxOutputBytes = limits.maxOutputBytes ??
    MAX_REPLAY_REWRITTEN_MANIFEST_BYTES;
  for (const limit of [maxLines, maxUris, maxOutputBytes]) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("replay.invalid_manifest_limit");
    }
  }

  const lines = manifest.split("\n");
  if (lines.length > maxLines) {
    throw new Error("replay.manifest_line_limit_exceeded");
  }

  let uriCount = 0;
  let outputBytes = 0;
  const output: string[] = [];
  const proxyUri = (uri: string) => {
    uriCount += 1;
    if (uriCount > maxUris) {
      throw new Error("replay.manifest_uri_limit_exceeded");
    }
    const proxied = proxyAbsolute(uri, manifestUrl);
    if (!proxied) throw new Error("replay.manifest_target_not_allowed");
    return proxied;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    let rewritten = line;
    if (trimmed.startsWith("#")) {
      // URI="..." inside tags (e.g. EXT-X-KEY, EXT-X-MAP, MEDIA).
      rewritten = line.replace(
        /URI="([^"]+)"/g,
        (_match, uri: string) => `URI="${proxyUri(uri)}"`,
      );
    } else if (trimmed) {
      // Bare URI line (segment or variant playlist).
      rewritten = proxyUri(trimmed);
    }

    const suffix = index < lines.length - 1 ? "\n" : "";
    outputBytes += Buffer.byteLength(rewritten + suffix, "utf8");
    if (outputBytes > maxOutputBytes) {
      throw new Error("replay.manifest_output_limit_exceeded");
    }
    output.push(rewritten, suffix);
  });

  return output.join("");
}

function proxyAbsolute(uri: string, baseUrl: string): string | null {
  try {
    const absolute = new URL(uri, baseUrl).toString();
    return proxiedStreamPath(absolute);
  } catch {
    return null;
  }
}

function copyHeader(from: Response, to: Headers, name: string) {
  const value = from.headers.get(name);
  if (value) setSafeHttpHeader(to, name, value);
}
