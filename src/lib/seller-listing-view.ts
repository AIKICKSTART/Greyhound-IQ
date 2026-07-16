export const SELLER_LISTING_VIEWS = ["all", "drafts", "archived"] as const;

export type SellerListingView = (typeof SELLER_LISTING_VIEWS)[number];

export function sellerListingStatuses(view: SellerListingView) {
  if (view === "drafts") return ["draft"] as const;
  if (view === "archived") return ["archived"] as const;
  return null;
}
