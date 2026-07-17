import { SellerListingsViewPage } from "../seller-listings-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Archived marketplace listings - GreyhoundIQ",
  description: "Review owner-only GreyhoundIQ archived marketplace records.",
  robots: { index: false, follow: false },
};

export default function SellerListingArchivedPage() {
  return <SellerListingsViewPage view="archived" />;
}
