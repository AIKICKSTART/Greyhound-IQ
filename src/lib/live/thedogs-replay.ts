import { fetchPublicInternetOrigin } from "@/lib/public-network";
import { readBoundedTextResponse } from "@/lib/remote-response";
import { isTheDogsLicensedUseApproved } from "./thedogs-access";

const THEDOGS_BASE =
  process.env.THEDOGS_BASE_URL ?? "https://www.thedogs.com.au";
const THEDOGS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const THEDOGS_FETCH_TIMEOUT_MS = 15_000;
const THEDOGS_RESPONSE_MAX_BYTES = 2 * 1024 * 1024;
const THEDOGS_HTML_POLICY = {
  maxBytes: THEDOGS_RESPONSE_MAX_BYTES,
  allowedContentTypes: ["text/html", "application/xhtml+xml"],
} as const;
const THEDOGS_JSON_POLICY = {
  maxBytes: THEDOGS_RESPONSE_MAX_BYTES,
  allowedContentTypes: ["application/json", "text/plain"],
} as const;

type VideoSourceResponse = {
  meta?: {
    status?: number;
    code?: string;
  };
  video?: {
    src?: string;
    title?: string;
    description?: string;
  };
};

type ReplayFetch = typeof fetchPublicInternetOrigin;

export type ResolvedTheDogsReplay = {
  pageUrl: string;
  streamUrl: string | null;
  streamContentType: string | null;
  embedUrl: string | null;
  embedType: "youtube" | null;
  title: string | null;
  description: string | null;
  sourceStatus: number | null;
  sourceCode: string | null;
};

export async function resolveTheDogsRaceReplay({
  sourceId,
  replayUrl,
}: {
  sourceId?: string | null;
  replayUrl?: string | null;
}, fetchImpl: ReplayFetch = fetchPublicInternetOrigin): Promise<ResolvedTheDogsReplay | null> {
  if (!isTheDogsLicensedUseApproved()) return null;
  const providerReplayUrl =
    replayUrl ??
    (isReplayVideoSourceId(sourceId)
      ? `/videos/watch/races/${sourceId}/replay`
      : await fetchReplayUrlFromRacePage(sourceId, fetchImpl));
  if (!providerReplayUrl) return null;

  const videoSourceId = extractVideoSourceId(providerReplayUrl);
  if (!videoSourceId) return null;

  const pageUrl = absoluteTheDogsUrl(providerReplayUrl);
  const source = await fetchVideoSource(videoSourceId, pageUrl, fetchImpl);
  // The stream src is an external CDN (cloudfront/skyracing), so it is not
  // host-pinned to thedogs; it is only returned for the browser to play under
  // CSP, never fetched server-side. Validate it is plain http(s).
  const streamUrl = publicHttpUrl(source.video?.src);
  const embedUrl = streamUrl
    ? null
    : await fetchReplayPageEmbed(pageUrl, fetchImpl);

  return {
    pageUrl,
    streamUrl,
    streamContentType: streamContentType(streamUrl),
    embedUrl,
    embedType: embedUrl ? "youtube" : null,
    title: cleanHtml(source.video?.title),
    description: cleanHtml(source.video?.description),
    sourceStatus: embedUrl ? 200 : source.meta?.status ?? null,
    sourceCode: embedUrl
      ? "thedogs-page-youtube"
      : source.meta?.code ?? null,
  };
}

// SSRF guard: values fed here come from scraped/DB data. new URL(value, base)
// lets an absolute value (e.g. http://169.254.169.254/) override the base host,
// so every resolved URL is host-pinned to THEDOGS_BASE before it can be fetched.
export function absoluteTheDogsUrl(value: string) {
  const base = new URL(THEDOGS_BASE);
  const url = new URL(value, THEDOGS_BASE);
  if (url.protocol !== "https:" || url.origin !== base.origin) {
    throw new Error("thedogs.url_host_not_allowed");
  }
  return url.toString();
}

function publicHttpUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function fetchReplayUrlFromRacePage(
  sourceId: string | null | undefined,
  fetchImpl: ReplayFetch,
) {
  if (!isTheDogsLicensedUseApproved() || !sourceId) return null;

  try {
    const response = await fetchImpl(absoluteTheDogsUrl(sourceId), {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(THEDOGS_FETCH_TIMEOUT_MS),
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "X-Application-Layout": "injection",
        "user-agent": THEDOGS_USER_AGENT,
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const html = await readBoundedTextResponse(response, THEDOGS_HTML_POLICY);
    return parseReplayUrl(html);
  } catch {
    return null;
  }
}

async function fetchVideoSource(
  videoSourceId: string,
  pageUrl: string,
  fetchImpl: ReplayFetch,
): Promise<VideoSourceResponse> {
  if (!isTheDogsLicensedUseApproved()) return {};
  try {
    const response = await fetchImpl(
      absoluteTheDogsUrl(`/api/videos/player/source/race-replay/${videoSourceId}`),
      {
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(THEDOGS_FETCH_TIMEOUT_MS),
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "en-US,en;q=0.9",
          origin: THEDOGS_BASE,
          referer: pageUrl,
          "user-agent": THEDOGS_USER_AGENT,
          "x-requested-with": "XMLHttpRequest",
        },
      }
    );
    const parsed = parseJson<VideoSourceResponse>(
      await readBoundedTextResponse(response, THEDOGS_JSON_POLICY),
    ) ?? {};
    return {
      ...parsed,
      meta: {
        ...parsed.meta,
        status: parsed.meta?.status ?? response.status,
      },
    };
  } catch {
    return {};
  }
}

async function fetchReplayPageEmbed(
  pageUrl: string,
  fetchImpl: ReplayFetch,
) {
  try {
    const response = await fetchImpl(pageUrl, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(THEDOGS_FETCH_TIMEOUT_MS),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": THEDOGS_USER_AGENT,
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const html = await readBoundedTextResponse(response, THEDOGS_HTML_POLICY);
    return parseYouTubeEmbed(html);
  } catch {
    return null;
  }
}

export function parseYouTubeEmbed(html: string) {
  for (const match of html.matchAll(
    /<iframe\b[^>]*\bsrc=["']([^"']+)["']/gi,
  )) {
    try {
      const url = new URL(decodeEntities(match[1] ?? ""));
      const videoId = url.pathname.match(
        /^\/embed\/([A-Za-z0-9_-]{11})$/,
      )?.[1];
      if (
        url.protocol === "https:" &&
        (url.hostname === "www.youtube.com" ||
          url.hostname === "www.youtube-nocookie.com") &&
        videoId
      ) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function parseReplayUrl(html: string) {
  return (
    firstMatch(html, /<a[^>]+data-turbolinks-action="video"[^>]+href="([^"]+)"/i) ||
    firstMatch(html, /<a[^>]+race-header__media__item--replay[^>]+href="([^"]+)"/i) ||
    firstMatch(html, /<a[^>]+href="([^"]*\/videos\/watch\/races\/\d+\/replay[^"]*)"/i) ||
    null
  );
}

function extractVideoSourceId(replayUrl: string) {
  return replayUrl.match(/\/videos\/watch\/races\/(\d+)\/replay\b/i)?.[1];
}

function isReplayVideoSourceId(value?: string | null) {
  return Boolean(value?.match(/^\d+$/));
}

function streamContentType(value: string | null | undefined) {
  if (!value) return null;
  const pathname = new URL(value, THEDOGS_BASE).pathname.toLowerCase();
  if (pathname.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (pathname.endsWith(".mp4")) return "video/mp4";
  return null;
}

function cleanHtml(value = "") {
  return (
    decodeEntities(
      value
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    ) || null
  );
}

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 10))
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function parseJson<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] ?? "";
}
