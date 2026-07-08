import type { MetadataRoute } from "next";
import { getActiveTracks } from "@/lib/queries";

// Track list comes from the DB, which is unavailable at build time — generate
// per request so the build doesn't try to prerender it.
export const dynamic = "force-dynamic";

const SITE = "https://greyhoundsiq.com.au";

// Public, indexable routes only. Auth-gated / app-shell routes (/account, /feed,
// /pulse, /messages, /admin) are deliberately excluded — they carry no public
// SEO value and are noindexed via middleware.
const STATIC_ROUTES = [
  "",
  "/races",
  "/results",
  "/dogs",
  "/tracks",
  "/breeding",
  "/statistics",
  "/agents",
  "/marketplace",
  "/groups",
  "/pricing",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1.0 : 0.7,
  }));

  let trackEntries: MetadataRoute.Sitemap = [];
  try {
    const tracks = await getActiveTracks();
    trackEntries = tracks.map((track) => ({
      url: `${SITE}/tracks/${track.id}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    }));
  } catch {
    // DB unavailable (e.g. build/preview) — still emit the static routes.
  }

  return [...staticEntries, ...trackEntries];
}
