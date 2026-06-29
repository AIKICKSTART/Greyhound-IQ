import type { MetadataRoute } from "next";

const SITE = "https://greyhoundiq.com.au";

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
    "/forum",
    "/listings",
    "/messages",
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
