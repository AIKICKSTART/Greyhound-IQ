import type { NextConfig } from "next";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseImageHost = supabaseUrl ? safeHostname(supabaseUrl) : null;

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75, 78, 82],
    minimumCacheTTL: 31536000,
    remotePatterns: supabaseImageHost
      ? [
          {
            protocol: "https",
            hostname: supabaseImageHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;

function safeHostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
