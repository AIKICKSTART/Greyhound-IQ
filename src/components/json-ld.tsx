import { headers } from "next/headers";

const SITE_URL = "https://greyhoundsiq.com.au";

type JsonLdData = Record<string, unknown>;

/**
 * Renders a JSON-LD structured data block. Server component — the script is in
 * the SSR payload so crawlers and AI ingestors see it without executing JS.
 * Reads the per-request nonce (set in proxy.ts) so the strict nonce-based CSP
 * does not drop the tag in browsers / the Rich Results renderer.
 */
export async function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Sitewide Organization identity. */
export const organizationSchema: JsonLdData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "GreyhoundIQ",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/icon.png`,
    width: 512,
    height: 512,
  },
  description:
    "Australian greyhound racing intelligence platform. Real-time race cards, AI predictions, breeding analytics, and community for breeders and owners.",
  areaServed: { "@type": "Country", name: "Australia" },
};

/** Sitewide WebSite entity with Sitelinks Searchbox pointed at dog search. */
export const websiteSchema: JsonLdData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: "GreyhoundIQ",
  description:
    "Australian greyhound racing intelligence — race cards, form, breeding analytics, AI predictions.",
  publisher: { "@id": `${SITE_URL}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/dogs?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

/** Builds a BreadcrumbList from ordered [name, path] pairs. */
export function breadcrumbSchema(
  items: ReadonlyArray<{ name: string; path: string }>
): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
