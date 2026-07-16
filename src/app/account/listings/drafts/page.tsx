import { SellerListingsViewPage } from "../seller-listings-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marketplace drafts - GreyhoundIQ",
  description: "Review owner-only GreyhoundIQ marketplace draft records.",
  robots: { index: false, follow: false },
};

export default function SellerListingDraftsPage() {
  return <SellerListingsViewPage view="drafts" />;
}
