export const SITE_ASSETS_BUCKET = "site-assets";
export const PUBLIC_USER_MEDIA_BUCKET = "public-user-media";
export const PRIVATE_USER_MEDIA_BUCKET = "private-user-media";

export const SUPABASE_STORAGE_BUCKETS = [
  SITE_ASSETS_BUCKET,
  PUBLIC_USER_MEDIA_BUCKET,
  PRIVATE_USER_MEDIA_BUCKET,
] as const;

export type SupabaseStorageBucket = (typeof SUPABASE_STORAGE_BUCKETS)[number];

const PUBLIC_BUCKETS = new Set<SupabaseStorageBucket>([
  SITE_ASSETS_BUCKET,
  PUBLIC_USER_MEDIA_BUCKET,
]);

const SITE_ASSET_SECTIONS: Record<string, string> = {
  "feature-advanced-stats.webp": "home",
  "feature-ai-predictions.webp": "home",
  "feature-breeding-analytics.webp": "home",
  "feature-pricing-product.webp": "home",
  "hero-breaking-from-boxes.webp": "brand",
  "hero-greyhoundiq-brand.webp": "brand",
  "logo-main.webp": "brand",
  "logo-mark-new.webp": "brand",
  "logo-wordmark.webp": "brand",
  "og-image.webp": "social",
  "site-footer-finish-line-bg.webp": "layout",
  "site-footer-racing-bg.webp": "layout",
  "site-header-banner-bg.webp": "layout",
  "site-header-gate-burst-landscape.webp": "layout",
  "site-header-gate-burst-portrait.webp": "layout",
  "site-header-racing-bg.webp": "layout",
  "demo-listing-dog-for-sale.webp": "listings",
  "demo-listing-pup-for-sale.webp": "listings",
  "demo-listing-share.webp": "listings",
  "demo-listing-stud-service.webp": "listings",
  "demo-listing-wanted.webp": "listings",
};

export function isSupabaseStorageBucket(
  value: string
): value is SupabaseStorageBucket {
  return SUPABASE_STORAGE_BUCKETS.includes(value as SupabaseStorageBucket);
}

export function isPublicStorageBucket(bucket: string) {
  return PUBLIC_BUCKETS.has(bucket as SupabaseStorageBucket);
}

export function mediaTypeForMimeType(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "document";
  return "file";
}

export function publicStorageUrl(
  bucket: SupabaseStorageBucket,
  objectPath: string
) {
  if (!isPublicStorageBucket(bucket)) return null;
  const supabaseUrl = configuredSupabaseUrl();
  if (!supabaseUrl) return null;

  const baseUrl = supabaseUrl.replace(/\/+$/, "");
  return `${baseUrl}/storage/v1/object/public/${bucket}/${encodeObjectPath(
    objectPath
  )}`;
}

export function siteAssetObjectPath(localPath: string) {
  const normalized = localPath.replace(/^\/+/, "");
  const filename = normalized.split("/").filter(Boolean).pop();
  if (!filename) return "site/general/asset";

  const section = SITE_ASSET_SECTIONS[filename] ?? "general";
  return `site/${section}/${filename}`;
}

export function siteAssetUrl(localPath: string) {
  return publicStorageUrl(SITE_ASSETS_BUCKET, siteAssetObjectPath(localPath)) ?? localPath;
}

function configuredSupabaseUrl() {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  if (!value || value.includes("YOUR_PROJECT_REF")) return null;

  try {
    const url = new URL(value);
    return url.toString();
  } catch {
    return null;
  }
}

function encodeObjectPath(objectPath: string) {
  return objectPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
