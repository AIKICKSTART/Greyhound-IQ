import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { BlockList, isIP, type LookupFunction } from "node:net";
import {
  Agent,
  fetch as undiciFetch,
  type RequestInit,
  type Response,
} from "undici";

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 512 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;
const URL_PATTERN = /https?:\/\/[^\s<>()"']+/i;
const NON_PUBLIC_ADDRESSES = createNonPublicAddressBlockList();

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
};

type PreviewFetcher = (input: string, init: RequestInit) => Promise<Response>;
type PreviewDnsResolver = (hostname: string) => Promise<LookupAddress[]>;

type ResolvedPublicUrl = {
  url: string;
  hostname: string;
  addresses: LookupAddress[];
};

export function firstPreviewUrl(body: string) {
  return body.match(URL_PATTERN)?.[0] ?? null;
}

export async function fetchLinkPreview(
  input: string,
  fetcher: PreviewFetcher = undiciFetch,
  resolver: PreviewDnsResolver = resolveAddresses
): Promise<LinkPreview> {
  let current = await resolvePublicHttpUrl(input, resolver);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const dispatcher = new Agent({
      connect: { lookup: createPinnedLookup(current.hostname, current.addresses) },
      connections: 1,
      pipelining: 0,
    });
    try {
      const response = await fetcher(current.url, {
        dispatcher,
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "GreyhoundIQ-LinkPreview/1.0",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || redirects === MAX_REDIRECTS) {
          throw new Error("link_preview.redirect_rejected");
        }
        current = await resolvePublicHttpUrl(
          new URL(location, current.url).toString(),
          resolver
        );
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("link_preview.fetch_failed");
      }
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        await response.body?.cancel();
        throw new Error("link_preview.invalid_content_type");
      }
      const html = await readLimitedText(response, MAX_RESPONSE_BYTES);
      const preview = extractLinkPreview(html, current.url);
      if (preview.imageUrl) {
        try {
          preview.imageUrl = await assertPublicHttpUrl(preview.imageUrl, resolver);
        } catch {
          preview.imageUrl = null;
        }
      }
      return preview;
    } finally {
      await dispatcher.close();
    }
  }
  throw new Error("link_preview.redirect_rejected");
}

export async function assertPublicHttpUrl(
  input: string,
  resolver: PreviewDnsResolver = resolveAddresses
) {
  return (await resolvePublicHttpUrl(input, resolver)).url;
}

async function resolvePublicHttpUrl(
  input: string,
  resolver: PreviewDnsResolver
): Promise<ResolvedPublicUrl> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("link_preview.invalid_url");
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new Error("link_preview.invalid_url");
  }
  if ((url.protocol === "http:" && url.port && url.port !== "80") ||
      (url.protocol === "https:" && url.port && url.port !== "443")) {
    throw new Error("link_preview.invalid_port");
  }
  const hostname = normalizeHostname(url.hostname);
  const family = isIP(hostname);
  const addresses = family
    ? [{ address: hostname, family }]
    : await resolver(hostname);
  if (
    addresses.length === 0 ||
    addresses.some(({ address, family: addressFamily }) =>
      !isPublicIpAddress(address) || isIP(address) !== addressFamily
    )
  ) {
    throw new Error("link_preview.private_address");
  }
  url.hash = "";
  return { url: url.toString(), hostname, addresses };
}

async function resolveAddresses(hostname: string) {
  return lookup(hostname, { all: true, verbatim: true });
}

export function createPinnedLookup(
  hostname: string,
  addresses: LookupAddress[]
): LookupFunction {
  const expectedHostname = normalizeHostname(hostname);
  const pinned = addresses.map(({ address, family }) => ({ address, family }));

  return (requestedHostname, options, callback) => {
    if (normalizeHostname(requestedHostname) !== expectedHostname) {
      callback(lookupError("ENOTFOUND", "Pinned DNS hostname mismatch"), "", 0);
      return;
    }
    const requestedFamily = options.family === "IPv4"
      ? 4
      : options.family === "IPv6"
        ? 6
        : options.family;
    const candidates = requestedFamily === 4 || requestedFamily === 6
      ? pinned.filter(({ family }) => family === requestedFamily)
      : pinned;
    if (candidates.length === 0) {
      callback(lookupError("EAI_ADDRFAMILY", "No pinned address for requested family"), "", 0);
      return;
    }
    if (options.all) {
      callback(null, candidates);
      return;
    }
    callback(null, candidates[0].address, candidates[0].family);
  };
}

export function isPublicIpAddress(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  const family = isIP(normalized);
  return family !== 0 && !NON_PUBLIC_ADDRESSES.check(
    normalized,
    family === 4 ? "ipv4" : "ipv6"
  );
}

export function extractLinkPreview(html: string, pageUrl: string): LinkPreview {
  const metadata = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (key && attrs.content && !metadata.has(key)) metadata.set(key, attrs.content);
  }
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const image = metadata.get("og:image") ?? metadata.get("twitter:image") ?? null;
  return {
    url: pageUrl,
    title: cleanMetadata(metadata.get("og:title") ?? titleMatch?.[1] ?? null, 200),
    description: cleanMetadata(
      metadata.get("og:description") ?? metadata.get("description") ?? null,
      500
    ),
    imageUrl: resolvePublicMetadataUrl(image, pageUrl),
    siteName: cleanMetadata(metadata.get("og:site_name") ?? null, 100),
  };
}

async function readLimitedText(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("link_preview.response_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parseAttributes(tag: string) {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? "");
  }
  return attributes;
}

function cleanMetadata(value: string | null, maxLength: number) {
  if (!value) return null;
  const cleaned = decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function resolvePublicMetadataUrl(value: string | null, pageUrl: string) {
  if (!value) return null;
  try {
    const url = new URL(value, pageUrl);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeHostname(hostname: string) {
  return hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

function lookupError(code: string, message: string) {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

function createNonPublicAddressBlockList() {
  const blockList = new BlockList();
  for (const [network, prefix] of [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ] as const) {
    blockList.addSubnet(network, prefix, "ipv4");
  }
  for (const [network, prefix] of [
    ["::", 96],
    ["64:ff9b::", 96],
    ["64:ff9b:1::", 48],
    ["100::", 64],
    ["2001::", 32],
    ["2001:2::", 48],
    ["2001:10::", 28],
    ["2001:20::", 28],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["fc00::", 7],
    ["fe80::", 10],
    ["fec0::", 10],
    ["ff00::", 8],
  ] as const) {
    blockList.addSubnet(network, prefix, "ipv6");
  }
  return blockList;
}
