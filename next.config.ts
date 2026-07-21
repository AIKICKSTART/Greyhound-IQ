import type { NextConfig } from "next";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseImageRemotePattern = supabaseUrl
  ? safeImageRemotePattern(supabaseUrl)
  : null;

type RemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    cpus: 4,
    authInterrupts: true,
    serverActions: {
      bodySizeLimit: "1mb",
    },
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
          // Production only: a dev server that ever responds over https would
          // otherwise pin HSTS for localhost in the browser (2 years, all
          // ports), breaking every plain-http localhost app until cleared.
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
                },
              ]
            : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          {
            key: "X-Frame-Options",
            value:
              process.env.NODE_ENV === "production" &&
              process.env.ENABLE_DEVICE_PREVIEWS !== "true"
                ? "DENY"
                : "SAMEORIGIN",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), display-capture=(self), geolocation=(self)",
          },
          // Content-Security-Policy is set per-request in src/proxy.ts so
          // script-src can carry a fresh nonce. Keep it out of here to avoid a
          // duplicate, nonce-less header.
        ],
      },
    ];
  },
  async redirects() {
    return [
      ...(process.env.NODE_ENV !== "production"
        ? [
            {
              source: "/:path*",
              has: [{ type: "host" as const, value: "127.0.0.1" }],
              destination: "http://localhost:3000/:path*",
              permanent: false,
            },
          ]
        : []),
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
