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
  "feature-advanced-stats-green.webp": "home",
  "feature-advanced-stats-v2.webp": "home",
  "feature-ai-predictions.webp": "home",
  "feature-ai-predictions-blue.webp": "home",
  "feature-ai-predictions-v2.webp": "home",
  "feature-breeding-analytics.webp": "home",
  "feature-breeding-analytics-gold.webp": "home",
  "feature-breeding-analytics-v2.webp": "home",
  "feature-career-form-purple.webp": "home",
  "feature-full-career-form-v2.webp": "home",
  "feature-pricing-product.webp": "home",
  "greyhoundiq-app-icon-dark.png": "brand",
  "greyhoundiq-app-icon-light.png": "brand",
  "hero-breaking-from-boxes.webp": "brand",
  "hero-greyhoundiq-brand.webp": "brand",
  "greyhoundiq-compact-ghiq-lockup.webp": "brand",
  "greyhoundiq-icon-mark.png": "brand",
  "greyhoundiq-iq-icon-dark.webp": "brand",
  "greyhoundiq-iq-icon-light.webp": "brand",
  "greyhoundiq-wordmark-compact-ghiq.png": "brand",
  "logo-main.webp": "brand",
  "logo-main-purple-gold.webp": "brand",
  "logo-mark-new.webp": "brand",
  "logo-mark-purple-gold.webp": "brand",
  "logo-wordmark.webp": "brand",
  "logo-wordmark-purple-gold.webp": "brand",
  "og-image.webp": "social",
  "site-footer-finish-line-cinematic.webp": "layout",
  "site-footer-finish-line-bg.webp": "layout",
  "site-footer-racing-bg.webp": "layout",
  "site-header-banner-bg.webp": "layout",
  "site-header-gate-burst-landscape.webp": "layout",
  "site-header-gate-burst-portrait.webp": "layout",
  "site-header-racing-bg.webp": "layout",
  "wentworth-gate-hero.webp": "brand",
  "wentworth-track-banner-landscape.webp": "layout",
  "wentworth-track-banner-portrait.webp": "layout",
  "wentworth-track-footer.webp": "layout",
  "wentworth-track-hero.webp": "brand",
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
  if (!shouldUseSupabaseSiteAssets()) return localPath;

  return publicStorageUrl(SITE_ASSETS_BUCKET, siteAssetObjectPath(localPath)) ?? localPath;
}

function shouldUseSupabaseSiteAssets() {
  return (
    process.env.NEXT_PUBLIC_USE_SUPABASE_SITE_ASSETS === "true" ||
    process.env.USE_SUPABASE_SITE_ASSETS === "true"
  );
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
