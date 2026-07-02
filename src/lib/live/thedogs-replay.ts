const THEDOGS_BASE =
  process.env.THEDOGS_BASE_URL ?? "https://www.thedogs.com.au";
const THEDOGS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const THEDOGS_FETCH_TIMEOUT_MS = 15_000;

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

export type ResolvedTheDogsReplay = {
  pageUrl: string;
  streamUrl: string | null;
  streamContentType: string | null;
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
}): Promise<ResolvedTheDogsReplay | null> {
  const providerReplayUrl = replayUrl ?? (await fetchReplayUrlFromRacePage(sourceId));
  if (!providerReplayUrl) return null;

  const videoSourceId = extractVideoSourceId(providerReplayUrl);
  if (!videoSourceId) return null;

  const pageUrl = absoluteTheDogsUrl(providerReplayUrl);
  const source = await fetchVideoSource(videoSourceId, pageUrl);
  const streamUrl = source.video?.src ?? null;

  return {
    pageUrl,
    streamUrl,
    streamContentType: streamContentType(streamUrl),
    title: cleanHtml(source.video?.title),
    description: cleanHtml(source.video?.description),
    sourceStatus: source.meta?.status ?? null,
    sourceCode: source.meta?.code ?? null,
  };
}

export function absoluteTheDogsUrl(value: string) {
  return new URL(value, THEDOGS_BASE).toString();
}

async function fetchReplayUrlFromRacePage(sourceId?: string | null) {
  if (!sourceId) return null;

  try {
    const response = await fetch(absoluteTheDogsUrl(sourceId), {
      cache: "no-store",
      signal: AbortSignal.timeout(THEDOGS_FETCH_TIMEOUT_MS),
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "X-Application-Layout": "injection",
        "user-agent": THEDOGS_USER_AGENT,
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    return parseReplayUrl(html);
  } catch {
    return null;
  }
}

async function fetchVideoSource(
  videoSourceId: string,
  pageUrl: string
): Promise<VideoSourceResponse> {
  try {
    const response = await fetch(
      absoluteTheDogsUrl(`/api/videos/player/source/race-replay/${videoSourceId}`),
      {
        cache: "no-store",
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
    const parsed = parseJson<VideoSourceResponse>(await response.text()) ?? {};
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

function streamContentType(value: string | null | undefined) {
  if (!value) return null;
  const pathname = new URL(value).pathname.toLowerCase();
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
