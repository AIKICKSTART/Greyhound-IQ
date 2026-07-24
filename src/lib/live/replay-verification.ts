import "server-only";

import { createHash } from "node:crypto";

import {
  embedUrlFromReplayPage,
  officialRaceReplayUrl,
  replayPlaybackState,
  type ReplayPlaybackState,
} from "./race-replay";
import { isReplayProxyAuthorised } from "./replay-rights";
import { validateReplayTarget } from "./replay-proxy";

const MAX_REDIRECTS = 5;
const MAX_CHECK_BYTES = 128 * 1024;
const CHECK_TIMEOUT_MS = 15_000;

export type ReplayVerificationInput = {
  id: string;
  raceId: string;
  sourceProvider: string;
  sourceId: string;
  pageUrl: string;
  embedSourceType?: string | null;
  sourceStatus?: number | null;
  sourceCode?: string | null;
  streamUrl?: string | null;
  streamContentType?: string | null;
  jurisdiction?: string | null;
};

export type ReplayVerificationResult = {
  playbackState: ReplayPlaybackState;
  outcome: "verified" | "external" | "pending" | "failed";
  verificationStatus: "verified" | "external" | "pending" | "failed";
  httpStatus: number | null;
  mediaContentType: string | null;
  evidenceSha256: string;
  checkedUrl: string | null;
};

export async function verifyReplaySource(
  input: ReplayVerificationInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ReplayVerificationResult> {
  const playbackState = replayPlaybackState(input);
  const target = verificationTarget(input);
  if (!target) {
    return result(input, {
      playbackState,
      outcome: playbackState === "failed" ? "failed" : "pending",
      httpStatus: null,
      mediaContentType: null,
      checkedUrl: null,
      bodySha256: null,
    });
  }

  try {
    const response = await safeFetch(target, input, fetchImpl);
    const body = await readBounded(response);
    const contentType = response.headers.get("content-type");
    const isMetadata = target.kind === "metadata";
    const isManifest =
      target.kind === "stream" &&
      (contentType?.toLowerCase().includes("mpegurl") ||
        input.streamContentType?.toLowerCase().includes("mpegurl") ||
        new URL(target.url).pathname.toLowerCase().endsWith(".m3u8"));
    const valid =
      response.ok &&
      body.length > 0 &&
      (!isMetadata || validOEmbed(body, target.provider)) &&
      (!isManifest || new TextDecoder().decode(body).includes("#EXTM3U"));
    const outcome = valid
      ? playbackState === "external"
        ? "external"
        : "verified"
      : transientStatus(response.status)
        ? "pending"
        : "failed";
    return result(input, {
      playbackState,
      outcome,
      httpStatus: response.status,
      mediaContentType: contentType,
      checkedUrl: response.url || target.url,
      bodySha256: sha256(body),
    });
  } catch {
    return result(input, {
      playbackState,
      outcome: "failed",
      httpStatus: null,
      mediaContentType: null,
      checkedUrl: target.url,
      bodySha256: null,
    });
  }
}

function transientStatus(status: number) {
  return status === 403 || status === 408 || status === 425 || status === 429 || status >= 500;
}

function verificationTarget(input: ReplayVerificationInput) {
  if (
    input.streamUrl &&
    isReplayProxyAuthorised({
      jurisdiction: input.jurisdiction,
      sourceProvider: input.sourceProvider,
    })
  ) {
    const stream = validateReplayTarget(input.streamUrl);
    if (stream) return { kind: "stream" as const, url: stream.toString() };
  }
  const metadata = oEmbedTarget(input.pageUrl);
  if (metadata) return metadata;
  const page = officialRaceReplayUrl(input);
  return page ? { kind: "page" as const, url: page } : null;
}

async function safeFetch(
  target: {
    kind: "metadata" | "page" | "stream";
    url: string;
    provider?: "vimeo" | "youtube";
  },
  input: ReplayVerificationInput,
  fetchImpl: typeof fetch,
) {
  let url = target.url;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept:
          target.kind === "stream"
            ? "application/vnd.apple.mpegurl,*/*"
            : target.kind === "metadata"
              ? "application/json"
              : "text/html,*/*",
        Range: `bytes=0-${MAX_CHECK_BYTES - 1}`,
        "User-Agent": "GreyhoundsIQ-ReplayVerifier/1.0",
      },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location || redirect === MAX_REDIRECTS) {
      throw new Error("Replay redirect could not be validated.");
    }
    if (target.kind === "metadata") {
      throw new Error("Replay metadata redirect is not permitted.");
    }
    const next = new URL(location, url).toString();
    const allowed =
      target.kind === "stream"
        ? validateReplayTarget(next)?.toString()
        : officialRaceReplayUrl({ ...input, pageUrl: next });
    if (!allowed) throw new Error("Replay redirect left the provider allowlist.");
    url = allowed;
  }
  throw new Error("Replay redirect limit exceeded.");
}

function oEmbedTarget(pageUrl: string) {
  const embed = embedUrlFromReplayPage(pageUrl);
  if (!embed) return null;
  const parsed = new URL(embed.embedUrl);
  if (embed.type === "youtube") {
    const videoId = parsed.pathname.match(/^\/embed\/([A-Za-z0-9_-]{6,32})$/)?.[1];
    if (!videoId) return null;
    const url = new URL("https://www.youtube.com/oembed");
    url.searchParams.set(
      "url",
      `https://www.youtube.com/watch?v=${videoId}`,
    );
    url.searchParams.set("format", "json");
    return {
      kind: "metadata" as const,
      provider: "youtube" as const,
      url: url.toString(),
    };
  }
  const videoId = parsed.pathname.match(/^\/video\/(\d+)$/)?.[1];
  if (!videoId) return null;
  const url = new URL("https://vimeo.com/api/oembed.json");
  url.searchParams.set("url", `https://vimeo.com/${videoId}`);
  return {
    kind: "metadata" as const,
    provider: "vimeo" as const,
    url: url.toString(),
  };
}

function validOEmbed(
  body: Uint8Array,
  provider: "vimeo" | "youtube" | undefined,
) {
  try {
    const payload = JSON.parse(new TextDecoder().decode(body)) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return false;
    }
    const record = payload as Record<string, unknown>;
    return (
      record.type === "video" &&
      typeof record.html === "string" &&
      record.html.includes("<iframe") &&
      record.provider_name === (provider === "youtube" ? "YouTube" : "Vimeo")
    );
  } catch {
    return false;
  }
}

async function readBounded(response: Response) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (length < MAX_CHECK_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = MAX_CHECK_BYTES - length;
    const chunk = value.subarray(0, remaining);
    chunks.push(chunk);
    length += chunk.length;
    if (chunk.length < value.length) {
      await reader.cancel();
      break;
    }
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}

function result(
  input: ReplayVerificationInput,
  evidence: {
    playbackState: ReplayPlaybackState;
    outcome: "verified" | "external" | "pending" | "failed";
    httpStatus: number | null;
    mediaContentType: string | null;
    checkedUrl: string | null;
    bodySha256: string | null;
  },
): ReplayVerificationResult {
  return {
    playbackState: evidence.playbackState,
    outcome: evidence.outcome,
    verificationStatus: evidence.outcome,
    httpStatus: evidence.httpStatus,
    mediaContentType: evidence.mediaContentType,
    checkedUrl: evidence.checkedUrl,
    evidenceSha256: sha256(
      JSON.stringify({
        id: input.id,
        raceId: input.raceId,
        sourceProvider: input.sourceProvider,
        sourceId: input.sourceId,
        pageUrl: input.pageUrl,
        streamUrl: input.streamUrl ?? null,
        ...evidence,
      }),
    ),
  };
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}
