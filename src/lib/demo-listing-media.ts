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
  width: 1586,
  height: 992,
};

const LISTING_IMAGES: Record<string, string[]> = {
  pup_for_sale: ["/images/demo-listings/demo-listing-pup-for-sale.png"],
  dog_for_sale: ["/images/demo-listings/demo-listing-dog-for-sale.png"],
  stud_service: ["/images/demo-listings/demo-listing-stud-service.png"],
  wanted: ["/images/demo-listings/demo-listing-wanted.png"],
  share: ["/images/demo-listings/demo-listing-share.png"],
};

const ALL_IMAGES = [
  "/images/demo-listings/demo-listing-pup-for-sale.png",
  "/images/demo-listings/demo-listing-dog-for-sale.png",
  "/images/demo-listings/demo-listing-stud-service.png",
  "/images/demo-listings/demo-listing-share.png",
  "/images/demo-listings/demo-listing-wanted.png",
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
    src,
    alt:
      index === 0
        ? `${listing.title} listing media`
        : `${listing.title} listing media ${index + 1}`,
    ...IMAGE_SIZE,
  }));
}

function demoListingMediaEnabled() {
  if (DEMO_MEDIA_ENABLED) return DEMO_MEDIA_ENABLED === "true";
  return process.env.NODE_ENV !== "production";
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
