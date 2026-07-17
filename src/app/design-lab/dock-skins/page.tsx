import type { Metadata } from "next";
import { isDockSkinKey } from "@/components/dock-skin-catalogue";
import { DockSkinCataloguePreview } from "@/components/dock-skin-catalogue-preview";
import { requireDesignLabReviewer } from "@/lib/design-lab-access";

export const metadata: Metadata = {
  title: "Dock Skin Catalogue - GreyhoundIQ Design Lab",
  description: "Isolated review surface for the GreyhoundIQ D1-D6 mobile dock skins.",
  robots: { index: false, follow: false },
};

export default async function DockSkinCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ dock?: string }>;
}) {
  await requireDesignLabReviewer();

  const resolved = await searchParams;
  const initialSkin = isDockSkinKey(resolved.dock) ? resolved.dock : "D1";

  return (
    <>
      <style>{`
        body:has([data-dock-skin-lab]) .giq-site-header,
        body:has([data-dock-skin-lab]) .giq-member-header,
        body:has([data-dock-skin-lab]) .giq-mobile-dock,
        body:has([data-dock-skin-lab]) .giq-hub-conversation-dock,
        body:has([data-dock-skin-lab]) .giq-footer-shell,
        body:has([data-dock-skin-lab]) .giq-alert-wrap {
          display: none !important;
        }
      `}</style>
      <DockSkinCataloguePreview initialSkin={initialSkin} />
    </>
  );
}
