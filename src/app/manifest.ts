import type { MetadataRoute } from "next";
import { siteAssetUrl } from "@/lib/storage-paths";

const LOGO_MARK = siteAssetUrl("/images/logo-mark-purple-gold.webp");

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GreyhoundIQ",
    short_name: "GreyhoundIQ",
    description: "Australian greyhound racing data platform. Race cards, breeding, AI predictions.",
    start_url: "/",
    display: "standalone",
    background_color: "#08050B",
    theme_color: "#8F2CC8",
    icons: [
      { src: "/icon.png", sizes: "any", type: "image/png" },
      { src: LOGO_MARK, sizes: "512x512", type: "image/webp" },
    ],
  };
}
