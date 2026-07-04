import { PUBLIC_USER_MEDIA_BUCKET } from "@/lib/storage-paths";

const MAX_LISTING_IMAGES = 10;
const MAX_LISTING_VIDEOS = 1;

export const DOG_LISTING_TYPES = new Set([
  "pup_for_sale",
  "dog_for_sale",
  "stud_service",
]);

type ListingAcknowledgementInput = {
  type: string;
  welfareAcknowledged?: boolean;
  legalAcknowledged?: boolean;
};

type ListingMediaPolicyInput = {
  mimeType: string;
  storageBucket: string;
};

export function assertListingAcknowledgements(
  input: ListingAcknowledgementInput
) {
  if (!DOG_LISTING_TYPES.has(input.type)) return;
  if (!input.welfareAcknowledged || !input.legalAcknowledged) {
    throw new Error("listing.disclaimer_required");
  }
}

export function assertListingMediaPolicy(media: ListingMediaPolicyInput[]) {
  const imageCount = media.filter((item) => item.mimeType.startsWith("image/")).length;
  const videoCount = media.filter((item) => item.mimeType.startsWith("video/")).length;

  if (imageCount + videoCount !== media.length) {
    throw new Error("listing.media_unsupported");
  }
  if (media.some((item) => item.storageBucket !== PUBLIC_USER_MEDIA_BUCKET)) {
    throw new Error("listing.media_must_be_public");
  }
  if (imageCount > MAX_LISTING_IMAGES) {
    throw new Error("listing.too_many_images");
  }
  if (videoCount > MAX_LISTING_VIDEOS) {
    throw new Error("listing.too_many_videos");
  }
}
