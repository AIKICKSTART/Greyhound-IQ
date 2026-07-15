import { lookup as dnsLookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import {
  Agent,
  fetch as undiciFetch,
  type Dispatcher,
  type RequestInit as UndiciRequestInit,
  type Response as UndiciResponse,
} from "undici";

export type ReplayResolvedAddress = {
  address: string;
  family: number;
};

export type ReplayAddressResolver = (
  hostname: string,
) => Promise<readonly ReplayResolvedAddress[]>;

type ReplayUndiciFetch = (
  input: string | URL,
  init?: UndiciRequestInit,
) => Promise<UndiciResponse>;

type ReplayFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

type ReplayNetworkDependencies = {
  createDispatcher?: (lookup: LookupFunction) => Dispatcher;
  fetch?: ReplayUndiciFetch;
};

export const REPLAY_CONNECT_TIMEOUT_MS = 5_000;
export const REPLAY_HEADER_TIMEOUT_MS = 20_000;
export const REPLAY_BODY_IDLE_TIMEOUT_MS = 30_000;

export async function resolveReplayAddresses(
  hostname: string,
): Promise<readonly ReplayResolvedAddress[]> {
  return dnsLookup(hostname, { all: true, order: "verbatim" });
}

export function isPublicInternetAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;

  const bytes = parseIpv6(address);
  if (!bytes) return false;

  // IPv4-mapped IPv6 must be subjected to the complete IPv4 policy.
  if (
    bytes.slice(0, 10).every((byte) => byte === 0) &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff
  ) {
    return isPublicIpv4(
      `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`,
    );
  }

  // Conservatively admit assigned global unicast only. This excludes
  // unspecified, loopback, link-local, ULA, multicast and translation ranges.
  if ((bytes[0] & 0xe0) !== 0x20) return false;

  return ![
    { prefix: [0x20, 0x01, 0x00], bits: 23 }, // IETF special-purpose space
    { prefix: [0x20, 0x01, 0x0d, 0xb8], bits: 32 }, // documentation
    { prefix: [0x20, 0x02], bits: 16 }, // 6to4 tunnelling
    { prefix: [0x3f, 0xfe], bits: 16 }, // former 6bone
    { prefix: [0x3f, 0xff, 0x00], bits: 20 }, // documentation
  ].some(({ prefix, bits }) => hasPrefix(bytes, prefix, bits));
}

export function createPublicAddressLookup(
  resolver: ReplayAddressResolver = resolveReplayAddresses,
): LookupFunction {
  return (hostname, options, callback) => {
    void resolver(hostname).then(
      (resolved) => {
        if (resolved.length === 0) {
          callback(replayLookupError("ENOTFOUND", hostname), "");
          return;
        }

        const addresses: ReplayResolvedAddress[] = [];
        for (const candidate of resolved) {
          const family = isIP(candidate.address);
          if (
            (family !== 4 && family !== 6) ||
            family !== candidate.family ||
            !isPublicInternetAddress(candidate.address)
          ) {
            callback(replayLookupError("EACCES", hostname), "");
            return;
          }
          addresses.push({ address: candidate.address, family });
        }

        const requestedFamily = options.family === 4 || options.family === 6
          ? options.family
          : 0;
        const eligible = requestedFamily === 0
          ? addresses
          : addresses.filter(({ family }) => family === requestedFamily);
        if (eligible.length === 0) {
          callback(replayLookupError("EAI_ADDRFAMILY", hostname), "");
          return;
        }

        // Node connects only to the address or address set returned here; it
        // does not perform a second DNS lookup after this security decision.
        if (options.all) {
          callback(null, eligible);
        } else {
          callback(null, eligible[0].address, eligible[0].family);
        }
      },
      (error: unknown) => {
        callback(asLookupError(error, hostname), "");
      },
    );
  };
}

export function createPinnedReplayFetch(
  resolver: ReplayAddressResolver = resolveReplayAddresses,
  dependencies: ReplayNetworkDependencies = {},
): ReplayFetch {
  const lookup = createPublicAddressLookup(resolver);
  const dispatcher = dependencies.createDispatcher?.(lookup) ??
    new Agent({
      connections: 8,
      maxOrigins: 8,
      pipelining: 1,
      connect: {
        lookup,
        timeout: REPLAY_CONNECT_TIMEOUT_MS,
      },
      headersTimeout: REPLAY_HEADER_TIMEOUT_MS,
      bodyTimeout: REPLAY_BODY_IDLE_TIMEOUT_MS,
    });
  const fetchImpl = dependencies.fetch ?? undiciFetch;

  return async (input, init) => {
    // Only DNS is overridden. The original URL hostname remains the TLS SNI
    // and certificate-verification name, and rejectUnauthorized stays enabled.
    const response = await fetchImpl(input, {
      ...(init as UndiciRequestInit | undefined),
      dispatcher,
    });
    return response as unknown as Response;
  };
}

let defaultReplayFetch: ReplayFetch | undefined;

export function fetchPinnedReplayOrigin(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  defaultReplayFetch ??= createPinnedReplayFetch();
  return defaultReplayFetch(input, init);
}

function isPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);

  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function parseIpv6(address: string): Uint8Array | null {
  if (isIP(address) !== 6 || address.includes("%")) return null;
  let normalized = address.toLowerCase();

  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":");
    const ipv4 = normalized.slice(lastColon + 1);
    if (isIP(ipv4) !== 4) return null;
    const octets = ipv4.split(".").map(Number);
    normalized = `${normalized.slice(0, lastColon)}:${(
      (octets[0] << 8) |
      octets[1]
    ).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1]
    ? halves[1].split(":")
    : [];
  if (halves.length === 1 && left.length !== 8) return null;
  if (left.length + right.length > 7) return null;

  const zeroCount = halves.length === 2 ? 8 - left.length - right.length : 0;
  const words = [...left, ...Array<string>(zeroCount).fill("0"), ...right];
  if (
    words.length !== 8 ||
    words.some((word) => !/^[0-9a-f]{1,4}$/.test(word))
  ) {
    return null;
  }

  const bytes = new Uint8Array(16);
  words.forEach((word, index) => {
    const value = Number.parseInt(word, 16);
    bytes[index * 2] = value >> 8;
    bytes[index * 2 + 1] = value & 0xff;
  });
  return bytes;
}

function hasPrefix(
  address: Uint8Array,
  prefix: readonly number[],
  prefixBits: number,
): boolean {
  const wholeBytes = Math.floor(prefixBits / 8);
  for (let index = 0; index < wholeBytes; index += 1) {
    if (address[index] !== prefix[index]) return false;
  }
  const remainingBits = prefixBits % 8;
  if (remainingBits === 0) return true;
  const mask = 0xff << (8 - remainingBits);
  return (address[wholeBytes] & mask) === (prefix[wholeBytes] & mask);
}

function replayLookupError(
  code: string,
  hostname: string,
): NodeJS.ErrnoException {
  const error = new Error(`replay.dns_address_not_allowed:${hostname}`) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

function asLookupError(error: unknown, hostname: string): NodeJS.ErrnoException {
  if (error instanceof Error) return error as NodeJS.ErrnoException;
  return replayLookupError("ENOTFOUND", hostname);
}
