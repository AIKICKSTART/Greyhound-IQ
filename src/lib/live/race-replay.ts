import { resolveTheDogsRaceReplay } from "./thedogs-replay";

const RACING_QUEENSLAND_BASE =
  process.env.RACING_QUEENSLAND_BASE_URL ??
  "https://www.racingqueensland.com.au";
const TASRACING_REPLAY_BUCKET =
  "https://tasracing-race-replays.s3.ap-southeast-2.amazonaws.com";
const REPLAY_FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export type ReplayEmbedType = "youtube" | "vimeo";

export type ResolvedRaceReplay = {
  pageUrl: string;
  streamUrl: string | null;
  streamContentType: string | null;
  title: string | null;
  description: string | null;
  sourceStatus: number | null;
  sourceCode: string | null;
  embedUrl?: string | null;
  embedType?: ReplayEmbedType | null;
};

export type RaceVideoReplayRecord = {
  sourceProvider?: string | null;
  sourceId?: string | null;
  pageUrl?: string | null;
  embedSourceType?: string | null;
  streamUrl?: string | null;
  streamContentType?: string | null;
  title?: string | null;
  description?: string | null;
  sourceStatus?: number | null;
  sourceCode?: string | null;
};

export async function resolveRaceVideoReplay(
  video: RaceVideoReplayRecord
): Promise<ResolvedRaceReplay | null> {
  const provider = normaliseKey(video.sourceProvider);
  const embedSourceType = normaliseKey(video.embedSourceType);
  const pageUrl = normalisePublicUrl(video.pageUrl);
  const storedStreamUrl = normalisePublicUrl(video.streamUrl);

  if (provider === "racing-queensland" || embedSourceType === "racing-queensland") {
    return resolveRacingQueenslandReplay(pageUrl, video);
  }

  if (provider === "thedogs" || embedSourceType === "race-replay") {
    const replay = await resolveTheDogsRaceReplay({
      sourceId: video.sourceId,
      replayUrl: pageUrl,
    });
    return replay ? { ...replay, embedUrl: null, embedType: null } : storedReplay(video);
  }

  if (provider === "tasracing" || embedSourceType === "tasracing-hls") {
    const streamUrl =
      storedStreamUrl ??
      (video.sourceId ? tasracingStreamUrl(video.sourceId) : null);
    return streamUrl
      ? {
          pageUrl: pageUrl ?? streamUrl,
          streamUrl,
          streamContentType: streamContentType(streamUrl),
          title: video.title ?? null,
          description: video.description ?? null,
          sourceStatus: video.sourceStatus ?? 200,
          sourceCode: video.sourceCode ?? "tasracing-public-angle",
          embedUrl: null,
          embedType: null,
        }
      : storedReplay(video);
  }

  if (provider === "greyhoundswa" || embedSourceType === "vimeo") {
    return resolveVimeoReplay(video);
  }

  const embed = embedUrlFromReplayPage(pageUrl);
  if (embed) {
    return {
      pageUrl: pageUrl ?? embed.embedUrl,
      streamUrl: null,
      streamContentType: null,
      title: video.title ?? null,
      description: video.description ?? null,
      sourceStatus: video.sourceStatus ?? 200,
      sourceCode: video.sourceCode ?? embed.type,
      embedUrl: embed.embedUrl,
      embedType: embed.type,
    };
  }

  return storedReplay(video);
}

export async function resolveProviderRaceReplay({
  sourceProvider,
  sourceId,
  replayUrl,
}: {
  sourceProvider?: string | null;
  sourceId?: string | null;
  replayUrl?: string | null;
}) {
  const provider = normaliseKey(sourceProvider);
  const pageUrl = normalisePublicUrl(replayUrl);
  if (provider === "thedogs") {
    const replay = await resolveTheDogsRaceReplay({ sourceId, replayUrl: pageUrl });
    return replay ? { ...replay, embedUrl: null, embedType: null } : null;
  }
  if (provider === "racing-queensland") {
    return resolveRacingQueenslandReplay(pageUrl, { sourceProvider, sourceId });
  }
  const embed = embedUrlFromReplayPage(pageUrl);
  return embed && pageUrl
    ? {
        pageUrl,
        streamUrl: null,
        streamContentType: null,
        title: null,
        description: null,
        sourceStatus: 200,
        sourceCode: embed.type,
        embedUrl: embed.embedUrl,
        embedType: embed.type,
      }
    : null;
}

export async function resolveRacingQueenslandReplay(
  pageUrl: string | null,
  fallback: RaceVideoReplayRecord = {}
): Promise<ResolvedRaceReplay | null> {
  const safePageUrl = racingQueenslandPageUrl(pageUrl);
  if (!safePageUrl) return storedReplay(fallback);

  try {
    const response = await fetch(safePageUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(REPLAY_FETCH_TIMEOUT_MS),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": USER_AGENT,
      },
    });
    const html = await response.text();
    const streamUrl = response.ok ? extractRacingQueenslandStreamUrl(html) : null;
    return {
      pageUrl: safePageUrl,
      streamUrl,
      streamContentType: streamContentType(streamUrl),
      title: fallback.title ?? pageTitle(html),
      description: fallback.description ?? null,
      sourceStatus: response.status,
      sourceCode: streamUrl ? "racing-queensland-mp4" : "racing-queensland-page",
      embedUrl: null,
      embedType: null,
    };
  } catch {
    return storedReplay(fallback);
  }
}

export function extractRacingQueenslandStreamUrl(html: string) {
  const match = html.match(
    /https:\/\/mediarqs\.skyracing\.com\.au\/[^"' <]+\.mp4[^"' <]*/i
  );
  return match ? decodeEntities(match[0]) : null;
}

export function tasracingStreamUrl(stream: string) {
  const safeStream = stream.trim();
  if (!safeStream || safeStream.includes("/") || safeStream.includes("\\")) return null;
  return `${TASRACING_REPLAY_BUCKET}/${encodeURIComponent(safeStream)}/index.m3u8`;
}

export function parseGreyhoundsWaVimeoVideos(html: string) {
  const videos = new Map<number, { raceNumber: number; videoId: string; pageUrl: string }>();
  const pattern =
    /"name":"\d{8}R(\d{2})"[\s\S]*?"embedUrl":"(https:\/\/player\.vimeo\.com\/video\/(\d+)(?:\?h=[A-Za-z0-9]+)?)/g;
  for (const match of html.matchAll(pattern)) {
    const raceNumber = Number.parseInt(match[1] ?? "", 10);
    const embedUrl = decodeEntities(match[2] ?? "");
    const videoId = match[3];
    if (!Number.isFinite(raceNumber) || !videoId || !embedUrl) continue;
    videos.set(raceNumber, {
      raceNumber,
      videoId,
      pageUrl: embedUrl,
    });
  }
  return [...videos.values()].sort((a, b) => a.raceNumber - b.raceNumber);
}

export function parseTheDogsReplayCards(html: string) {
  const cards: Array<{
    raceNumber: number;
    videoSourceId: string;
    pageUrl: string;
    trackName: string;
    title: string;
  }> = [];
  const pattern =
    /<a[^>]+href="(\/videos\/watch\/races\/(\d+)\/replay)"[\s\S]*?<div class="video-card__title">([^<]+)<\/div>/gi;
  for (const match of html.matchAll(pattern)) {
    const title = cleanHtml(match[3] ?? "");
    const titleMatch = title?.match(/^(.+?)\s+Race\s+(\d+)\b/i);
    const raceNumber = Number.parseInt(titleMatch?.[2] ?? "", 10);
    const videoSourceId = match[2];
    const href = match[1];
    if (!title || !titleMatch?.[1] || !Number.isFinite(raceNumber)) {
      continue;
    }
    if (!videoSourceId || !href) continue;
    cards.push({
      raceNumber,
      videoSourceId,
      pageUrl: href,
      trackName: titleMatch[1],
      title,
    });
  }
  return cards;
}

export function embedUrlFromReplayPage(value: string | null | undefined) {
  const youtube = youtubeEmbedUrlFromPage(value);
  if (youtube) return { type: "youtube" as const, embedUrl: youtube };
  const vimeo = vimeoEmbedUrlFromPage(value);
  if (vimeo) return { type: "vimeo" as const, embedUrl: vimeo };
  return null;
}

export function youtubeEmbedUrlFromPage(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const id =
      host === "youtu.be"
        ? url.pathname.split("/").filter(Boolean)[0]
        : host.endsWith("youtube.com")
          ? url.searchParams.get("v") ?? youtubePathId(url.pathname)
          : null;
    if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}`;
  } catch {
    return null;
  }
}

export function vimeoEmbedUrlFromPage(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const hash = url.searchParams.get("h");
    const id =
      host === "vimeo.com"
        ? url.pathname.split("/").filter(Boolean)[0]
        : host === "player.vimeo.com" && url.pathname.startsWith("/video/")
          ? url.pathname.split("/").filter(Boolean)[1]
          : null;
    if (!id || !/^\d{6,}$/.test(id)) return null;
    const embed = new URL(`https://player.vimeo.com/video/${id}`);
    if (hash && /^[A-Za-z0-9]+$/.test(hash)) embed.searchParams.set("h", hash);
    return embed.toString();
  } catch {
    return null;
  }
}

export function streamContentType(value: string | null | undefined) {
  if (!value) return null;
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    if (pathname.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
    if (pathname.endsWith(".mp4")) return "video/mp4";
  } catch {
    return null;
  }
  return null;
}

function storedReplay(video: RaceVideoReplayRecord): ResolvedRaceReplay | null {
  const pageUrl = normalisePublicUrl(video.pageUrl);
  const streamUrl = normalisePublicUrl(video.streamUrl);
  const embed = embedUrlFromReplayPage(pageUrl);
  if (!pageUrl && !streamUrl && !embed) return null;
  return {
    pageUrl: pageUrl ?? streamUrl ?? embed?.embedUrl ?? "",
    streamUrl,
    streamContentType: video.streamContentType ?? streamContentType(streamUrl),
    title: video.title ?? null,
    description: video.description ?? null,
    sourceStatus: video.sourceStatus ?? null,
    sourceCode: video.sourceCode ?? null,
    embedUrl: embed?.embedUrl ?? null,
    embedType: embed?.type ?? null,
  };
}

async function resolveVimeoReplay(
  video: RaceVideoReplayRecord
): Promise<ResolvedRaceReplay | null> {
  const pageUrl = normalisePublicUrl(video.pageUrl);
  const sourcePageUrl =
    pageUrl ??
    (video.sourceId && /^\d{6,}$/.test(video.sourceId)
      ? `https://vimeo.com/${video.sourceId}`
      : null);
  const storedEmbed = embedUrlFromReplayPage(pageUrl)?.embedUrl ?? null;
  const fetchedEmbed =
    storedEmbed?.includes("?h=") || !sourcePageUrl
      ? null
      : await fetchVimeoEmbedUrl(sourcePageUrl);
  const embed = storedEmbed?.includes("?h=")
    ? storedEmbed
    : fetchedEmbed ?? storedEmbed;
  if (!sourcePageUrl && !embed) return null;
  return {
    pageUrl: sourcePageUrl ?? embed ?? "",
    streamUrl: null,
    streamContentType: null,
    title: video.title ?? null,
    description: video.description ?? null,
    sourceStatus: video.sourceStatus ?? (embed ? 200 : null),
    sourceCode: video.sourceCode ?? "vimeo",
    embedUrl: embed,
    embedType: embed ? "vimeo" : null,
  };
}

async function fetchVimeoEmbedUrl(pageUrl: string) {
  try {
    const response = await fetch(pageUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(REPLAY_FETCH_TIMEOUT_MS),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": USER_AGENT,
      },
    });
    if (!response.ok) return null;
    const html = (await response.text()).replaceAll("\\/", "/");
    return (
      html.match(/https:\/\/player\.vimeo\.com\/video\/\d+\?h=[A-Za-z0-9]+/i)?.[0] ??
      null
    );
  } catch {
    return null;
  }
}

function racingQueenslandPageUrl(value: string | null | undefined) {
  const url = normalisePublicUrl(value, RACING_QUEENSLAND_BASE);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const baseHost = new URL(RACING_QUEENSLAND_BASE).hostname.replace(/^www\./, "");
    const host = parsed.hostname.replace(/^www\./, "");
    return host === baseHost &&
      parsed.pathname.includes("/racing/replays/tab-race-replays/race-player/")
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function normalisePublicUrl(value?: string | null, base?: string) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function normaliseKey(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function pageTitle(html: string) {
  return cleanHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
}

function youtubePathId(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "embed" || parts[0] === "shorts" ? parts[1] : null;
}

function cleanHtml(value = "") {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  ) || null;
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
