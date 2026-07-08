import type { NextConfig } from "next";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseImageRemotePattern = supabaseUrl
  ? safeImageRemotePattern(supabaseUrl)
  : null;

type RemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number];

const replayFrameOrigins =
  "https://www.youtube-nocookie.com https://player.vimeo.com";
const replayMediaOrigins =
  "https://www.thedogs.com.au https://mediarqs.skyracing.com.au https://tasracing-race-replays.s3.ap-southeast-2.amazonaws.com";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    authInterrupts: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75, 78, 82],
    minimumCacheTTL: 31536000,
    remotePatterns: supabaseImageRemotePattern
      ? [supabaseImageRemotePattern]
      : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), display-capture=(self), geolocation=()",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/listings", destination: "/marketplace", permanent: true },
      { source: "/listings/:path*", destination: "/marketplace/:path*", permanent: true },
      { source: "/forum", destination: "/groups", permanent: true },
      { source: "/forum/:path*", destination: "/groups/:path*", permanent: true },
      { source: "/messages", destination: "/pulse", permanent: true },
      { source: "/messages/:path*", destination: "/pulse/:path*", permanent: true },
    ];
  },
};

export default nextConfig;

// Built from env at build time. Origins missing in dev are simply omitted.
// ponytail: 'unsafe-inline' script-src; nonce-based CSP is the deferred upgrade.
function contentSecurityPolicy() {
  const supa = safeOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supaWs = supa?.replace(/^http/, "ws");
  const lk = safeOrigin(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const devWs =
    process.env.NODE_ENV !== "production"
      ? "ws://localhost:* ws://127.0.0.1:*"
      : undefined;

  const join = (...parts: Array<string | undefined>) =>
    parts.filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    join("img-src 'self' data: blob:", supa),
    join("media-src 'self' blob:", supa, replayMediaOrigins),
    join("connect-src 'self'", supa, supaWs, lk, devWs),
    join("frame-src 'self'", replayFrameOrigins),
    "worker-src 'self' blob:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function safeOrigin(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function safeImageRemotePattern(value: string): RemotePattern | null {
  try {
    const url = new URL(value);
    const protocol = url.protocol.replace(":", "");

    if (protocol !== "http" && protocol !== "https") {
      return null;
    }

    return {
      protocol,
      hostname: url.hostname,
      port: url.port,
      pathname: "/storage/v1/object/public/**",
    };
  } catch {
    return null;
  }
}
