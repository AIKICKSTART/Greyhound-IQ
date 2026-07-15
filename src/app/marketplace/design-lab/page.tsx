import type { Metadata } from "next";

import { MarketplaceTemplateCatalogue } from "@/components/marketplace-template-catalogue";
import { resolveMarketplaceTemplateKey } from "@/components/marketplace-template-variants";
import { requireDesignLabReviewer } from "@/lib/design-lab-access";

// Six Marketplace page-template directions, switchable via ?template=, on an
// isolated review route that deliberately has no production persistence.
export const metadata: Metadata = {
  title: "Marketplace Design Lab | GreyhoundIQ",
  description: "Review the M1–M6 GreyhoundIQ Marketplace page templates.",
  robots: { index: false, follow: false },
};

export default async function MarketplaceDesignLabPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string | string[] }>;
}) {
  await requireDesignLabReviewer();

  const params = await searchParams;
  const rawTemplate = params.template;
  const template = resolveMarketplaceTemplateKey(
    Array.isArray(rawTemplate) ? rawTemplate[0] : rawTemplate
  );

  return <MarketplaceTemplateCatalogue selected={template} />;
}
