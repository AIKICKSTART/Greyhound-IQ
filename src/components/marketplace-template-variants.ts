export const MARKETPLACE_TEMPLATE_OPTIONS = [
  {
    key: "M1",
    label: "Grandstand Market",
    detail: "Editorial discovery",
  },
  {
    key: "M2",
    label: "Compact Exchange",
    detail: "Dense comparison",
  },
  {
    key: "M3",
    label: "Market Control",
    detail: "Operations overview",
  },
  {
    key: "M4",
    label: "Seller Cockpit",
    detail: "Listing workflow",
  },
  {
    key: "M5",
    label: "Social Bazaar",
    detail: "Community discovery",
  },
  {
    key: "M6",
    label: "Data Exchange",
    detail: "Record comparison",
  },
] as const;

export type MarketplaceTemplateKey =
  (typeof MARKETPLACE_TEMPLATE_OPTIONS)[number]["key"];

export const DEFAULT_MARKETPLACE_TEMPLATE: MarketplaceTemplateKey = "M1";

export function resolveMarketplaceTemplateKey(
  value: string | null | undefined
): MarketplaceTemplateKey {
  return MARKETPLACE_TEMPLATE_OPTIONS.some(
    (option) => option.key === value
  )
    ? (value as MarketplaceTemplateKey)
    : DEFAULT_MARKETPLACE_TEMPLATE;
}
