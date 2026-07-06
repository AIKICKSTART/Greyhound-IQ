import type { MetadataRoute } from "next";

const SITE = "https://greyhoundsiq.com.au";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/account",
    "/races",
    "/results",
    "/dogs",
    "/tracks",
    "/breeding",
    "/statistics",
    "/agents",
    "/marketplace",
    "/groups",
    "/feed",
    "/pulse",
    "/pricing",
    "/about",
    "/contact",
    "/terms",
    "/privacy",
  ];

  return routes.map((route) => ({
    url: `${SITE}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1.0 : 0.7,
  }));
}
