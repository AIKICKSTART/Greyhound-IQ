import { SellerListingsViewPage } from "./seller-listings-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My marketplace listings - GreyhoundIQ",
  description: "Review marketplace listings owned by your GreyhoundIQ account.",
  robots: { index: false, follow: false },
};

export default function SellerListingsPage() {
  return <SellerListingsViewPage view="all" />;
}
