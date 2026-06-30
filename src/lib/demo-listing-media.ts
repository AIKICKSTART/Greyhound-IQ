import { siteAssetUrl } from "@/lib/storage-paths";

export interface DemoListingImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

type ListingForDemoMedia = {
  id: string;
  type: string;
  title: string;
};

const DEMO_MEDIA_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LISTING_MEDIA ??
  process.env.ENABLE_DEMO_LISTING_MEDIA;

const IMAGE_SIZE = {
  width: 1200,
  height: 751,
};

const LISTING_IMAGES: Record<string, string[]> = {
  pup_for_sale: ["/images/demo-listings/demo-listing-pup-for-sale.webp"],
  dog_for_sale: ["/images/demo-listings/demo-listing-dog-for-sale.webp"],
  stud_service: ["/images/demo-listings/demo-listing-stud-service.webp"],
  wanted: ["/images/demo-listings/demo-listing-wanted.webp"],
  share: ["/images/demo-listings/demo-listing-share.webp"],
};

const ALL_IMAGES = [
  "/images/demo-listings/demo-listing-pup-for-sale.webp",
  "/images/demo-listings/demo-listing-dog-for-sale.webp",
  "/images/demo-listings/demo-listing-stud-service.webp",
  "/images/demo-listings/demo-listing-share.webp",
  "/images/demo-listings/demo-listing-wanted.webp",
];

export function getDemoListingImages(
  listing: ListingForDemoMedia,
  count = 1
): DemoListingImage[] {
  if (!demoListingMediaEnabled()) return [];

  const primaryImages = LISTING_IMAGES[listing.type] ?? ALL_IMAGES;
  const start = stableIndex(listing.id, primaryImages.length);
  const ordered = [
    ...rotate(primaryImages, start),
    ...rotate(ALL_IMAGES, stableIndex(listing.id, ALL_IMAGES.length)),
  ];
  const unique = Array.from(new Set(ordered));

  return unique.slice(0, count).map((src, index) => ({
    src: siteAssetUrl(src),
    alt:
      index === 0
        ? `${listing.title} listing media`
        : `${listing.title} listing media ${index + 1}`,
    ...IMAGE_SIZE,
  }));
}

function demoListingMediaEnabled() {
  if (DEMO_MEDIA_ENABLED) {
    return !["0", "false", "off", "no"].includes(
      DEMO_MEDIA_ENABLED.trim().toLowerCase()
    );
  }
  return true;
}

function rotate<T>(items: T[], start: number) {
  return [...items.slice(start), ...items.slice(0, start)];
}

function stableIndex(value: string, length: number) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return length === 0 ? 0 : hash % length;
}
