import { existsSync } from "node:fs";
import { join } from "node:path";

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

export const DEMO_LISTING_ITEM_IMAGE_PATHS: Readonly<Record<string, string>> = {
  cmr08ug600001l404mftpnk44:
    "/images/demo-listings/items/ritza-trish-champion-litter.webp",
  "204eae2b-1c03-4b1d-9b59-48101a5ef161":
    "/images/demo-listings/items/royal-tornado-slate-portrait.webp",
  "7edcf947-36fa-45d3-8107-e2df04efad2a":
    "/images/demo-listings/items/torvi-triumph-aston-surprise.webp",
  "85834775-73e3-490e-ad52-8fdda11e8a7e":
    "/images/demo-listings/items/shadow-destiny-sunset-walk.webp",
  "30e2bdbd-2054-4511-a9b1-3dc057f53684":
    "/images/demo-listings/items/stonic-prince-kennel-handover.webp",
  "48a68816-3e6c-47dc-b284-666cb842fc1c":
    "/images/demo-listings/items/iron-sonic-zweck-slammer.webp",
  "b1bd6519-162a-49b5-baa4-ae551948b191":
    "/images/demo-listings/items/steel-sword-sweet-maverick-search.webp",
  "69cf2820-182b-46a1-82e3-8a1d3ef8906c":
    "/images/demo-listings/items/wonder-winner-western-travel.webp",
  "8c9de45d-da0b-451e-92ba-5a1dedc8b667":
    "/images/demo-listings/items/riptide-bomb-coastal-training.webp",
  "6d31b73c-1114-4a09-a9a1-fc365d47cbe4":
    "/images/demo-listings/items/xcite-nova-wanted-search.webp",
};

export const DEMO_LISTING_ITEM_IMAGE_ALT_TEXT: Readonly<Record<string, string>> = {
  cmr08ug600001l404mftpnk44:
    "Four healthy greyhound pups resting and exploring in a clean, sunlit Australian nursery courtyard.",
  "204eae2b-1c03-4b1d-9b59-48101a5ef161":
    "A slate-grey adult greyhound standing calmly in a polished kennel breezeway with a native garden beyond.",
  "7edcf947-36fa-45d3-8107-e2df04efad2a":
    "A young fawn greyhound standing in a clean, shaded South Australian limestone exercise courtyard.",
  "85834775-73e3-490e-ad52-8fdda11e8a7e":
    "A black greyhound walking safely on lead along a fenced coastal heath path at copper sunset.",
  "30e2bdbd-2054-4511-a9b1-3dc057f53684":
    "A calm red-fawn greyhound beside an unlabelled care folder in a clean, covered kennel handover bay.",
  "48a68816-3e6c-47dc-b284-666cb842fc1c":
    "A young black-and-white greyhound standing in a green Queensland exercise paddock after rain.",
  "b1bd6519-162a-49b5-baa4-ae551948b191":
    "A brindle female greyhound standing in side profile on a misty Victorian bush-edge assessment lane.",
  "69cf2820-182b-46a1-82e3-8a1d3ef8906c":
    "A white-and-fawn greyhound beside a secured travel crate in a shaded Western Australian loading bay.",
  "8c9de45d-da0b-451e-92ba-5a1dedc8b667":
    "A blue-grey greyhound resting beside water and a cooling towel in a fenced South Australian coastal courtyard.",
  "6d31b73c-1114-4a09-a9a1-fc365d47cbe4":
    "A blue greyhound standing calmly on lead in a clean South Australian first-assessment yard at dawn.",
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

  const itemImage = availableItemImage(listing.id);
  const primaryImages = itemImage
    ? [itemImage.src]
    : LISTING_IMAGES[listing.type] ?? ALL_IMAGES;
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
        ? itemImage?.alt ?? `${listing.title} listing media`
        : `${listing.title} listing media ${index + 1}`,
    ...IMAGE_SIZE,
  }));
}

function availableItemImage(listingId: string) {
  const src = DEMO_LISTING_ITEM_IMAGE_PATHS[listingId];
  if (!src) return null;
  return existsSync(join(process.cwd(), "public", src.slice(1)))
    ? { src, alt: DEMO_LISTING_ITEM_IMAGE_ALT_TEXT[listingId] }
    : null;
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
