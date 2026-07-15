export const MARKETPLACE_PAGE_SIZE = 24;
export const MARKETPLACE_MAX_PAGE = 40;

export const MARKETPLACE_SORT_VALUES = [
  "",
  "created_at",
  "price",
  "expires_at",
] as const;

export type MarketplaceSort = (typeof MARKETPLACE_SORT_VALUES)[number];

type MarketplaceNavigationState = {
  q: string;
  category: string;
  sort: string;
};

export function parseMarketplaceSearch(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

export function parseMarketplaceCategory(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 100) : "";
}

export function parseMarketplaceSort(value: unknown): MarketplaceSort {
  return typeof value === "string" &&
    MARKETPLACE_SORT_VALUES.includes(value as MarketplaceSort)
    ? (value as MarketplaceSort)
    : "";
}

export function parseMarketplacePage(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1) return 1;
  return Math.min(page, MARKETPLACE_MAX_PAGE);
}

export function marketplacePageOffset(page: number) {
  const boundedPage = parseMarketplacePage(String(page));
  return (boundedPage - 1) * MARKETPLACE_PAGE_SIZE;
}

export function parseMarketplaceOffset(value: unknown) {
  const maximumOffset = (MARKETPLACE_MAX_PAGE - 1) * MARKETPLACE_PAGE_SIZE;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return 0;
  }
  return Math.min(value, maximumOffset);
}

export function marketplacePageHref(
  state: MarketplaceNavigationState,
  targetPage: number,
) {
  const params = new URLSearchParams();
  const q = parseMarketplaceSearch(state.q);
  const category = parseMarketplaceCategory(state.category);
  const sort = parseMarketplaceSort(state.sort);
  const page = parseMarketplacePage(String(targetPage));

  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/marketplace?${query}` : "/marketplace";
}
