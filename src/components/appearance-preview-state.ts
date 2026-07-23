import {
  PROTOTYPE_TEMPLATE_COMPOSITIONS,
  isPrototypeVariant,
  type PrototypeVariant,
} from "./prototype-variants";
import {
  isDockSkinKey,
  type DockSkinKey,
} from "./dock-skin-catalogue";
import {
  DEFAULT_MARKETPLACE_TEMPLATE,
  resolveMarketplaceTemplateKey,
  type MarketplaceTemplateKey,
} from "./marketplace-template-variants";

export type SponsoredMarketplaceVisibility = "on" | "off";

export type AppearancePreviewSearchParams = {
  app?: string | string[];
  dock?: string | string[];
  market?: string | string[];
  sponsored?: string | string[];
};

export type AppearancePreviewState = {
  app: PrototypeVariant;
  dock: DockSkinKey;
  market: MarketplaceTemplateKey;
  sponsored: SponsoredMarketplaceVisibility;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveSponsoredMarketplaceVisibility(
  value: string | string[] | undefined
): SponsoredMarketplaceVisibility {
  return firstValue(value) === "off" ? "off" : "on";
}

export function resolveAppearancePreviewState(
  searchParams: AppearancePreviewSearchParams
): AppearancePreviewState {
  const requestedApp = firstValue(searchParams.app);
  const app: PrototypeVariant = isPrototypeVariant(requestedApp)
    ? requestedApp
    : "A1";
  const recommendedDock = PROTOTYPE_TEMPLATE_COMPOSITIONS[app].recommendedDock;
  const requestedDock = firstValue(searchParams.dock);
  const dock: DockSkinKey = isDockSkinKey(requestedDock)
    ? requestedDock
    : recommendedDock;

  return {
    app,
    dock,
    market: resolveMarketplaceTemplateKey(firstValue(searchParams.market)) ??
      DEFAULT_MARKETPLACE_TEMPLATE,
    sponsored: resolveSponsoredMarketplaceVisibility(searchParams.sponsored),
  };
}

export function getAppearancePreviewQuery(state: AppearancePreviewState) {
  return new URLSearchParams({
    app: state.app,
    dock: state.dock,
    market: state.market,
    sponsored: state.sponsored,
  }).toString();
}
