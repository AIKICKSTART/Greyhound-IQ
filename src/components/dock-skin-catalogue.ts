export type DockRecommendedVariant = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export const DOCK_ACTION_REGISTRY = [
  { key: "home", label: "Home" },
  { key: "feed", label: "Feed" },
  { key: "post", label: "Post" },
  { key: "chat", label: "Chat" },
  { key: "menu", label: "Menu" },
] as const;

export type DockActionKey = (typeof DOCK_ACTION_REGISTRY)[number]["key"];

export const DOCK_SKIN_REGISTRY = [
  {
    key: "D1",
    label: "Carbon Rail",
    detail: "Angular graphite rail with a precise gold active edge.",
    recommendedVariant: "A1",
  },
  {
    key: "D2",
    label: "Gold Pulse",
    detail: "Metallic gold command bar with a pulsing central action.",
    recommendedVariant: "B2",
  },
  {
    key: "D3",
    label: "Purple Glass",
    detail: "Translucent violet glass with soft neon depth and bloom.",
    recommendedVariant: "C1",
  },
  {
    key: "D4",
    label: "Race Grid",
    detail: "Timing-board cells with lane markings and race-box colour.",
    recommendedVariant: "B1",
  },
  {
    key: "D5",
    label: "Minimal Chrome",
    detail: "A restrained silver line with a single gold position mark.",
    recommendedVariant: "A2",
  },
  {
    key: "D6",
    label: "Floating Pods",
    detail: "Five independent controls with an elevated posting pod.",
    recommendedVariant: "C2",
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  detail: string;
  recommendedVariant: DockRecommendedVariant;
}>;

export type DockSkinDefinition = (typeof DOCK_SKIN_REGISTRY)[number];
export type DockSkinKey = DockSkinDefinition["key"];

export function isDockSkinKey(value: string | null | undefined): value is DockSkinKey {
  return DOCK_SKIN_REGISTRY.some((skin) => skin.key === value);
}
